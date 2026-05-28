export class AudioHandler {
  constructor() {
    this.mediaStream = null;
    this.mediaRecorder = null;
    this.audioContext = null;
    this.isRecording = false;
    this.nextStartTime = 0;
    this.scheduledSources = [];
  }

  async initializeAudio() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      await this.audioContext.audioWorklet.addModule(
        "/js/audio/pcm-processor.js"
      );
    }
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  async startRecording(onAudioData) {
    await this.initializeAudio();

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const source = this.audioContext.createMediaStreamSource(
        this.mediaStream
      );
      this.audioWorkletNode = new AudioWorkletNode(
        this.audioContext,
        "pcm-processor"
      );

      this.audioWorkletNode.port.onmessage = (event) => {
        if (this.isRecording) {
          const downsampled = this.#downsampleBuffer(
            event.data,
            this.audioContext.sampleRate,
            16000
          );
          const pcm16 = this.#convertFloat32ToInt16(downsampled);
          if (typeof onAudioData === "function") onAudioData(pcm16);
        }
      };

      source.connect(this.audioWorkletNode);
      // Mute local feedback
      const muteGain = this.audioContext.createGain();
      muteGain.gain.value = 0;
      this.audioWorkletNode.connect(muteGain);
      muteGain.connect(this.audioContext.destination);

      this.isRecording = true;
    } catch (e) {
      console.error("Error starting audio:", e);
      throw e;
    }
  }

  stopRecording() {
    this.isRecording = false;
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioWorkletNode) {
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }
  }

  async playAudio(arrayBuffer) {
    await this.initializeAudio();

    if (typeof arrayBuffer === 'string') {
      function base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
        return bytes.buffer;
      }
      arrayBuffer = base64ToArrayBuffer(arrayBuffer);
    }

    const pcmData = new Int16Array(arrayBuffer);
    const float32Data = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      float32Data[i] = pcmData[i] / 32768.0;
    }

    const buffer = this.audioContext.createBuffer(1, float32Data.length, 24000);
    buffer.getChannelData(0).set(float32Data);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    const now = this.audioContext.currentTime;
    this.nextStartTime = Math.max(now, this.nextStartTime);
    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;

    this.scheduledSources.push(source);
    source.onended = () => {
      const idx = this.scheduledSources.indexOf(source);
      if (idx > -1) this.scheduledSources.splice(idx, 1);
    };
  }
  stopAudioPlayback() {
    this.scheduledSources.forEach((s) => {
      try {
        s.stop();
      } catch (e) {}
    });
    this.scheduledSources = [];
    if (this.audioContext) {
      this.nextStartTime = this.audioContext.currentTime;
    }
  }

  mute() {
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
    }
  }

  unmute() {
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach(track => {
        track.enabled = true;
      });
    }
  }

  isMuted() {
    if (this.mediaStream) {
      return !this.mediaStream.getAudioTracks()[0]?.enabled;
    }
    return false;
  }






  // Utils
  #downsampleBuffer(buffer, sampleRate, outSampleRate) {
    if (outSampleRate === sampleRate) return buffer;
    const ratio = sampleRate / outSampleRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0,
        count = 0;
      for (
        let i = offsetBuffer;
        i < nextOffsetBuffer && i < buffer.length;
        i++
      ) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = accum / count;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }
  #convertFloat32ToInt16(buffer) {
    let l = buffer.length;
    const buf = new Int16Array(l);
    while (l--) {
      buf[l] = Math.min(1, Math.max(-1, buffer[l])) * 0x7fff;
    }
    return buf.buffer;
  }
}

window.data = '+f/6//j/9f/2//X/9P/0//T/9v/5//T/9//7//r/+//6//n/+f/7//r//f/+////AAAAAAAAAAD//////P/7//7/+v/9/wAA//8AAAAAAAAAAAEAAAABAAEAAwADAAUABAAFAAcABwAKAAcAAwACAAMABAAFAAQABAAFAAIAAwACAAQABgAGAAQAAwAGAAUAAgAHAAUAAgAFAAUABQACAAIAAgABAAIAAgABAAEAAAABAAAA///7//3/AQAAAP////8AAP7/AAD+/wAAAAAAAAAAAAACAAMABgAEAAQABQADAAMABAADAAUAAgAGAAIAAQAAAAEAAAAAAP7//v/+//z/+v/7//j/+//9//r/+P/3//j/+P/3//X/9f/1//f/9v/4//n/+f/4//j/9//2//b/8v/1//L/9f/1//X/9P/2//b/9v/6//j/+v/7//z/+v/+//z//P8CAAIAAAAAAAAAAQAAAAAAAQAAAAEAAQABAAEAAgACAAQAAgAEAAUABQAIAAgACgAKAAoADAAMAAwADgAOAA4AEAAOAA4ADgAQAA4AEgARAAwADgALAAsADAANAA0ACgAKAAwACQAMAAwADAANAAwACwALABAACgAMAA4AEAAQABEAEwATABUAEgATABIAEwATABMAEwASABUAEwAUABgAEgASABEAFAAXABUAGAAWABUAFgAUABMAEwASABIAFAAQABIAEAAQABIADgAQABAAEAAQABAAEAAPABAADgAQAA8ADQANAAwADQAOAAoACwAOAA4AEAAMAAoACgAIAAgABwAHAAUABgAEAAUABAADAAMABgABAAQABQABAAIA//////z//P/7//v//P/7//v/+f/6//n/+f/5//v/+f/7//7//f/+//v//f/8/////////wAAAAAAAAAAAQADAAQABAAHAAYABgAKAAUABgAHAAcABwAIAAkACAAJAAgACgAKAAoACwAMAAsADAALAA8AEgAVABcAEQAQABIAEQASABEAFAATABMAEwAUABIAEQAQABEADwARABQADgATAA8ADQALAAwADgANAA8ADwAPAA8AEAAQABAAEQAQABMAEgASAA4AEAAUABIAFQAVABUAFQAVABUAFQAUABQAEwATABQAEgATABQADwAVABAAEQARABEAEQARABIADwARABAADwAQAA4ADgAMAAsADAAKAAYABwAIAAoACgAJAAkACAAJAAgACQAKAAoACgAJAAsACgAIAAkACwAIAAoACQAJAAoACgAJAAcACAAHAAcABwAGAAYABgAGAAcABwAIAAgACgAGAAQABQAHAAgABwAIAAYABgAEAAQABAAAAAEA///9//z/+v/3//r/9//3//n/9//3//f/9//3//b/9//3//b/9//1//b/9f/1//T/8//x//P/+P/4//f/9v/3//b/9//2//b/9//3//b/9v/0//b/8//0//P/8//2//P/9f/1//X/9//3//f/+P/4//n/+v/5//v/+//8//3//f/8//z/AAABAAAAAAABAAIAAwADAAMAAwAEAAMABAAEAAQABQACAAQAAQADAAQAAQADAAMABAAEAAQABQAGAAcACAAHAAgACAAIAAkABwAIAAYACAAFAAIAAwADAAUABQAFAAUABgAGAAgACAAIAAkACwAKAAwACwAOAAwAEAARAA4ADwAPAA8ADwAOAA0ADQAMAAwACgAMAAsACQAKAAgABwAIAAsACwAIAAoACQAJAAsACwALAAwADAAOAA0ADgAOAA4ADwAPAA0ADgAOAAsADgAMAA0ADQANAA0ADQAOAAwADQAOAAwADAAMAAsADAAMAAsAEAATABIAEQARABEAEQARABIAEQAQABMAEgARABIAEAAQAA0ADQALAAoADgAMAA0ADAAKAAsACgAJAAkABwAIAAcABAAFAAQABAADAAIAAgAEAAMAAQACAAEAAQAAAAAAAAAAAP//AAAAAAAAAQAAAAAAAAAAAAMAAAD//////f/8//v/+//8//z/+//7//z/+f/3//j/9//2//T/9P/1//7////7//z/+//7//v/+v/7//v//P/8//z//f/9//3//f/9//3//P/8//3//P/9//v//P/9//v//P/7//z/+//6//z//P/7//3//P/9//r/9f/2//n/9v/2//b/9f/1//T/9P/z//P/8v/y//H/8v/x//D/8f/x//P/8v/z//L/8//y//P/8//0//X/9P/1//X/9//3//f/+P/3//f/9f/z//j/+P/3//n/9//5//f/+P/5//j/+v/5//n/+f/6//r/+v/7//z//P/8//r/+//8//v/+v/6//r/+v/7//z/+//7//z/+v/8//r/+//6//r/+f/1//f/9P/1//X/8//1//P/8//3//X/9//3//j/+P/6//n/+v/5//r/+//5//r/+v/7//z/+//7//z//f/8//3//f/+//3//v////7/AgACAAAAAAAAAP//AAD///7////9//7//f/9//z/+//8//n/+//5//r/+//4//v/+f/7//v//P/9//7//v///wAAAAAAAAEAAgADAAMABwABAAAAAwADAAMABQAFAAYABgAGAAYABgAGAAUABQAFAAMABAAEAAMABAACAAMAAQABAAEAAAABAAAAAQAAAP//AAD//wAAAAAAAP///v/+//r//f/9//z//f/9//3//f/9//z//f/8//3//f/+//7//v/////////+////AAD//wAA///+//z//f/8//3//f/9//3//f/+//////8AAAAA/P/6//7//v/+/wAA/v/+//////8AAP////////z//v/9//7//f///wAA/v/+//7//f/7//z//P/9//z/+//8//r/+f/4//j/+v/4//r/+//3//L/9P/2//T/9//3//f/9//3//f/+f/5//n/+v/8//v//P/8/////v/6/////v//////AAAAAAAAAAAAAAAAAgACAAIAAwACAAIAAgACAAEABgAIAAgABwAIAAcACQAHAAcABgAHAAcABgAFAAUABQAGAAYACAAHAAQABAAEAAQABQAGAAcACQAJAAgACQAKAAsACwAMAA0ADgAPABEAEgAOAA8AEQAPABAAEQARABAAEQARABEAEQASABEAEAAQAA8ADwAPAA4ADwAPABAAEAASABIAEwATABUAFgAXABYAFwAXABgAFgAXABYAFwAVABIAEgAQABEADwAOAA4ADQANAAwADAANAAwADQANAA4ADAAPAAwACgAOABAADwAQAA8ADwAPAA8ADgANAA0ACwAKAAkACgAJAAgACAAJAAMABgAFAAMAAwADAAIABAADAAMAAgAEAAMAAwACAAMAAwACAAMAAQADAAAAAQAAAAEAAAAAAAAAAAAAAAAAAgACAAIAAQACAAIAAgAEAAIA/v8AAAIAAQACAAIAAwADAAIAAgABAAAAAAAAAP//AAD+//7//f/9//v/+//9//v//P/7//z/+//8//v/+//6//v/+v/5//r/+//5//r/+//2//r/+//6//v/+//7//z//P/9//r/+v/6//n/9//3//b/9//3//j//f/7//v//P/7//z/+//9//v//f/+//3//////////v8AAP////8AAAEAAAD+/wAAAAABAAEAAQADAAMABAAEAAUABQAFAAUABgAFAAYAAwAFAAkABwAJAAgACQAJAAkACAAJAAgACAAIAAgACAAKAAgACQAJAAkACgAIAAoACAAJAAcACAAIAAgACgAJAAoACQALAAsACgALAAwACwAQABAACgAMAAsACwALAAsACwALAAsACgALAAoACgAKAAoACwALAAgACQAIAAUABgAHAAUABgAEAAMAAwABAAEAAAABAAAAAAAAAAEA//8AAAAA/f/9//7//v///wAAAAAAAAAAAQD//wAAAAAAAP///v/9//7//f/+/wAA///+//z//f/8//z//f/9//3//v/+////AAAAAAAAAQAAAAEAAQADAAAAAAAAAP7////+/////v////7//v////////8AAAAAAAAAAAAAAwABAAAAAQAAAAAA///+//7//v/+///////+/////v///////v8AAPz//P/8//z//P/7//v/+v/5//r/9//4//b/9v/2//X/9P/1//X/9v/y//H/8v/y//L/8v/1//T/9f/1//X/9f/2//T/9f/0//X/9f/0//b/+P/1//X/9f/0//b/9P/1//f/9//4//j/+f/5//n/+P/5//n/+P/8//j/9v/4//j/+P/4//f/+f/5//j/9//4//j/+P/3//j/+P/4//r/+v/7//j/+v/7//v//f/+//7//f/+//3//P/8//v/+v/7//z/+//8//r/+v////z//f/9//z//f/9//z//f/8//v//P/6//v/+v/5//r/+f/7//z//P/8//v/+v/7//r/+f/5//j/+P/2//f/9//2//X/9f/z//L/8P/u//L/8v/y//L/8P/x//D/8P/w/+//7//w/+//7//v//D/7//w//H/8//0//H/8v/z//H/8v/x//L/8//z//T/9P/0//T/9P/0//T/8v/y//L/8v/z//D/8f/v/+//8P/w//D/8P/x//H/8P/x//L/8v/y//P/8//x/+//8v/w//H/8v/y//T/8//1//X/9f/3//b/+P/3//n/+f/6//n/+f/8//7/AAAAAAAAAQABAAEAAwABAAEAAwACAAMAAwACAAIAAgADAAkABgAEAAUABAAGAAUABQAFAAUABQAFAAUABQAEAAQABgAGAAcABwAIAAQABQAGAAUABwAGAAYABgAGAAQAAwAFAAQAAwAFAAQABQAEAAgACgAFAAMABAADAAMABAADAAIAAgACAAEAAQABAAAAAAABAAAAAAAAAP7/AAADAAEABQACAAQAAwACAAQAAQAEAAQAAwAFAAUABAAEAAQABAAEAAIABAACAAQAAwACAAEAAAAAAP///f/+//z//P/7//v//v/8///////7//v//P/8//3//P/9//v//P/7//r/+v/5//n/9//3//b/9v/2//T/8//0//P/9P/0//X/9f/1//b/+P/1//f/9//4//n/9//4//f/9//8//r/+P/4//b/9v/1//b/9P/z//P/8//y//L/8f/x//D/7//v/+7/8f/w//D/8v/w//H/8f/z//H/8v/x/+//8P/w//D/8f/w//D/7//x//L/8v/y//H/8//x//P/8v/y//P/8//y//P/8//z//P/9f/1//X/+P/1//H/9P/z//P/8v/y//L/8f/z//L/8f/y//L/8v/z//P/9P/1//X/9f/1//P/9f/1//X/9v/2//b/9//3//n/+f/5//f/+f/4//f/+P/3//z/+v/7//3//v/9//7////+/wAA///9/////////wAAAAAAAAAAAQAFAAUAAgAFAAMABAAEAAUABAAFAAQABQADAAUABAAEAAQABAADAAUABQAAAAIAAgACAAIAAwAFAAMABQAFAAUABQAGAAUABQAGAAgACQAJAAsACQAIAAoACgAJAAoACgAKAAoACwALAA0ADgAPABAAEQARABIAEQAUABEAEgATABQAEwATABMAFAATABIAEgASABMAEgARABEADwAPABAACgANAA4ADQANAA0ADgALAA0ADAALAAoACgAKAAkACAAJAAkACAALAAsABgAIAAgACQAKAAoACgAKAA0ADQALAAsACwAMAAsADAANAAoACwAIAAkACwAMAAsACwALAAoACwAKAAkACQAKAAgACAAHAAcABwAHAAcABQAGAAYABQAFAAUABQAFAAYABQAGAAQAAwADAAMAAwADAAIAAQACAAMA/v///wAA////////AAD//wAA/f////////////7//v/+//7//f/9//7//v/+//3//f/9//z/+//7//n/+v/7//v/+//7//z//f/9//3/AAABAAEAAAABAAIAAgADAAUABQAFAAgABwAJAAkACAAIAAgACAAFAAgACwAJAAgACAAIAAYABwAHAAYABgAHAAgABwAIAAgABwAIAAgACAAJAAYACAAGAAgABwAGAAcABgAGAAUABgAFAAUAAwADAAMAAwADAAMABQACAAMAAwABAAEAAAABAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAD//wAABAABAAEAAwAAAAIAAAAAAAIAAQAAAAIAAQABAAIAAQAAAAEAAQAAAAAAAwABAAMAAgADAAIAAQACAAEAAAABAP//AAAAAAAAAAAAAP///v8CAAEAAgABAAAAAAAAAAAAAgABAAAAAgABAAEAAQAAAAEAAQABAAIAAAABAAAAAgADAAIAAwACAAMAAQACAAQABAACAAQAAwAEAAMABQADAAAAAAABAAAAAQAAAAAAAAAAAAAA/v////7//f/8//3//P/8//r/+//9//3////9//3//f/7//z//P/7//v/+//5//r/+v/6//r/+//5//v/AQD9/////v/9//3//f/9///////+/wAAAAAAAAAAAAAAAAAAAAABAAEAAwADAAQABQAGAAcABgAGAAcABwAGAAgABgAIAAkACAAJAAgACwANAAkADAAKAAkACAAJAAkACQAIAAcABwAHAAYABgAFAAQABAAEAAUAAgABAAEAAgABAAIAAQABAAEAAQAAAAEAAAAAAAAAAQAAAAAAAQD8//7/AAAAAAEAAQABAAAAAQAAAAAAAQAAAAEAAAAAAP/////+//7//P/8//7//f/9//z//P/7//r/+v/7//n/+P/6//n/+//7//v//f/8//7//P/6//z/+v/7//n/+//8//v/+v/7//v/+v/7//v/+//7//z/+//8//z//f/8//z//f/8//3//f/+/////v///wAAAAAAAAAA//8AAPz/+/8AAP///v/+//7///////7//v/+/////v////3//v///wAA/v///////v///////v/+//7////9///////+/wAAAAAAAAAAAAAAAAAA/f8AAP//AAAAAP7/AAD//wAAAAD+//3//v/8//3//f/8//7//f////7/+//9//v/+//8//n/+//5//j/+P/4//f/+P/6//r/+f/7//r/+f/3//j/+f/5//n/+f/6//r//P/7//v/+//7//v/+v/6//r/+v/7//r/+v/9//z/+//8//v//P/8//3//v/9//7//v/+/////f/+//3///////7////+/////f/8//3/+//6//n/+f/4//j/9//4//j/+P/3//j/+P/2//X/+v/5//n/+f/4//j/+f/5//n/+v/5//n/+P/5//j/+P/6//f/+f/5//r/+P/4//j/9//4//f/9//4//j/+f/5//r/+v/6//v/+v/7//n/+v/9//r/+f/5//j/+v/5//r/+v/6//r/+f/7//n/+v/5//r/+f/7//n/+v/7//r/+f/5//j/9//4//b/9v/2//b/+P/3//b/9//2//f/9v/0//r/+v/4//n/9//3//n/9//4//f/+f/3//n/+f/4//v/+f/6//v/+//9//v//f/9//7//////wAAAAAAAAAAAAAAAAEAAQACAAIAAwAFAAQAAgADAAIABAACAAIAAgABAAEAAQAAAAEAAAAAAAAAAAACAAAAAwAFAAIAAQABAAIAAQADAAIABAAEAAUABQAFAAYABQAFAAYABQAFAAYAAgAEAAQABAAFAAQABgAGAAUABQAGAAUABAAFAAQABQAFAAUABAAGAAQAAwACAAEAAgABAAEAAQAAAAEAAAABAAEAAQABAAEAAQABAAAAAAADAAQAAQACAAEAAQACAAIAAQACAAIAAwABAAIAAgABAAIAAQACAAIABAAFAAMAAQADAAIAAgACAAAAAQABAAAAAAAAAAAAAAAAAAAAAAD///7/AAD+//7///////3//v/+//3//f/+///////+//7/AAD///7//v8BAAAA/v/+//3//f///////////wAA//8BAAAAAAABAAAAAAAAAAEAAQACAAEAAQACAAEAAgACAAIAAgACAAEAAgACAAIAAgAEAAMABAAFAAcAAwADAAQAAQACAAEAAQAAAAAAAAAAAAAAAAAAAAAAAAD//wAA/f////3//f/9//7//P/7//z/+//7//v/+//6//r/+v/5//j/+P/1//L/8//0//L/8v/z//D/8P/w//H/7//u//D/7//u/+//7v/u/+//7f/u/+3/7f/s/+7/7f/t/+7/7f/u/+//7//v//D/8f/y//H/8v/y//P/7//v//H/8f/x//P/8//0//T/9f/1//X/9f/2//X/9//2//f/9v/2//j/9f/2//b/9v/2//X/9//1//f/9v/2//f/9//3//j/+f/4//j/+v/8//7//v/+//z//f/8//z//f/7//v//P/7//v/+//7//v//f/5//z//P/6//n/+v/6//v/+f/7//r/+v/7//r/+v/7//r/+f/8//r//P/9//3//v/7//r/+v/8//z//f/9//3//f/+//3//v//////AAAAAP//AAABAAAAAAAAAAAAAgAAAAIAAgADAAMAAwAEAAQABgAEAAYABwAHAAgACwANAA4ACwALAAwACwAMAAsADQANAA0ADQANAA4ADQAOAA4ADAAQAA4ADgAOAA4ADQANAA4ADQAPAA4ADwAQAA8AEAAQABEAEQARABMAEwARAA8ADwATABQAEwAVABUAFQAVABUAFQAWABQAFgAWABUAFQAXABUAFAAWABQAFAAVABMAFgAUABUAFQAUABQAFQAUABQAFQATABIAEgAQAA4ADQAOABAADwAQAA4AEAAOAA8ADwAOABAADgAOAA0ADwALAA0ADQAJAAsADAALAAoACgAKAAoACQAJAAgACQAIAAoACQAKAAoACwALAAsADQAIAAcACgAIAAoACQAKAAoACAAJAAoABwAHAAcABQAFAAUAAwACAAQAAgAAAAIAAQABAAEAAgABAAEAAAAAAAAA//////3//f/7//r/+v/3//r//P/9//z/+//7//r/+//6//r/+v/5//r/+P/4//n/9//5//f/+P/6//f/+f/5//n/+v/6//v/+//7//v//f/8//z//f/9//7//v/+//7/AAABAAEAAQABAAIAAgACAAIAAgADAAQAAwAEAAQABQAEAAUABAAGAAUABAAFAAUABQAGAAcABgAHAAcABwAIAAgABwAHAAcABwAHAAUACQAFAAMABAAEAAUABAAGAAUABQAFAAYABQAFAAUABQAEAAUABAAFAAMABwAHAAQABQAFAAQABAAEAAQABAADAAMAAQACAAAAAQAAAAAAAAAAAAMAAgAAAAEAAQAAAAEAAAAAAAEAAQAAAAIAAQABAAEAAAABAAAAAQABAP//AQAAAAEAAQABAAIAAQABAAAAAgABAAEAAAABAAAAAQAAAAAAAwAGAAMABQAFAAQABQAEAAUAAwAFAAUABgAEAAUABAAFAAQAAwADAAEABgAEAAMABAACAAMAAgACAAIAAAACAAEAAAAAAAAAAAAAAP//AAAAAAAA/v////7//f////7////8//3//v/+//3//f/9//3//P/9//7//f/7//v/+//4//n/+f/4//j/+P/4//n/+P/3//b/9f/1//X/9P/1//n/+//2//j/9//3//f/9v/3//f/9//4//f/+P/5//n/+P/6//j/+f/5//r/+f/4//r/+P/5//n/+f/6//r/+v/7//r//P/7//v/+//7//n/9v/4//v/+f/4//n/+P/3//f/9//3//f/9//3//f/9//3//b/9//1//j/9v/4//f/+P/5//j/+v/6//n/+v/6//z/+//7//z//P/7//z/+v/6//7////9//7////9//7///////7//v/+/////v////////8AAAAAAAAAAP///v///////v///////v8AAAAA/v///////v////7//f////7//v/5//n/+v/3//j/+P/2//f/9//3//j/9//2//j/9v/4//j/9v/4//b/9//2//X/9v/1//T/9v/z//T/9v/0//X/9f/2//X/+P/2//b/+f/6//j/9v/4//b/9//3//b/9v/2//X/9v/2//b/9v/0//X/9f/1//T/9//0//X/9v/0//b/9v/3//j/+P/5//v/+//8//3//v/+/wAAAAD+//z/AAAAAAAAAQABAAIAAgADAAMAAwADAAQABAAEAAQABAAGAAQABgAFAAQABgAFAAYABgAGAAYABwAGAAcABQAGAAUABQAGAAUABQAFAAIABAAGAAQABQAFAAQABAAFAAQABQAFAAUABAAEAAYABQAHAAYABQAGAAUABwAGAAcABgAGAAcABgAGAAcABwAIAAcACAAKAAoACgAKAAsABwAIAAkACQAKAAoACwAKAAoADAALAAwADAALAA0ACwAMAA0ADAANAA8ADAAMAA0ADAANAAwADQAMAAwADQANAAwACwAKAAsACwAKAAsADAAJAAYABgAJAAgACAAJAAgABwAIAAgACAAJAAgABwAIAAcACAAIAAkACAAEAAcABwAHAAcACAAIAAcACQAIAAgACQAIAAcACAAHAAgACAAHAAgACQALAAsACQAKAAgACQAJAAcABwAIAAYABwAFAAUABQAGAAYABwAFAAMABAAEAAMAAwAEAAMAAgACAAEAAAACAAEAAQABAAIAAQAEAAUABQADAAEABQADAAMABgAEAAQABgAGAAUABgAGAAUABQAFAAUABQAEAAUABAAEAAUABQAGAAUABwAHAAgACQAJAAoACQAJAAoACQAIAAkACQAJAAUABgAHAAYABwAGAAYABQAGAAUAAwAEAAQAAwAEAAMABAAFAAIAAwAFAAYABgAHAAgABwAIAAgABwAHAAcABwAGAAYABQAFAAUABQAEAAEAAgACAAEAAQABAAIAAQAAAAEAAAABAAEA//8AAAAAAAAAAAAA//8AAP7//////////////wAA//8AAP7/AAD//wAA/v///////v8AAP7/+//9/////////wAAAAD//wAA///+//7//f/+//z//f/8//z//P/7//z/+v/8//r/+f/6//n/+v/5//b/+P/2//b/9v/z//X/9f/y//X/9P/x//T/8//0//P/8//z//L/8v/x//D/8P/v/+//7v/t/+3/7v/t/+7/8v/v/+7/7//u/+3/7f/u/+z/7//v/+7/8P/w//D/8P/x//D/8P/y//P/8v/y//H/9P/0//P/9f/0//b/9f/1//b/9v/4//f/+P/3//j/9//3//z/+v/8//z//P/8//3//f/+//3////+//////8AAAAAAAABAAEAAgAAAAEAAQABAAIAAgACAAMAAwAEAAQABAAFAAUABQAGAAYACAAKAAwABwAHAAkACAAIAAkACAAJAAgACQAJAAkACQAKAAkACAAKAAgACQAJAAYABwAGAAgABgAGAAYABQAFAAUABAAFAAQABAAEAAQAAgAHAAQAAwACAAUABQAEAAUABAAGAAQABgAFAAQABQAEAAUAAwAFAAQABAAFAAcABgAFAAQABgAEAAUABgAFAAYABwAHAAgACAAIAAgACQAIAAoACgAKAAwACAAKAAoACQAJAAkACAAIAAgACAAJAAgACQAIAAkACgAHAAgACwAKAAkACQAIAAkACAAHAAcABwAHAAcABwAHAAYABwAHAAUABwAGAAQABQAEAAUABAAFAAQAAwADAAMAAQABAAEAAQAAAAAAAAAAAAAAAQD///////8AAAAAAAAAAAEAAgABAAIAAgABAAEAAQABAAEAAgAAAAIAAwABAAAAAQAAAAEAAQABAAIAAgADAAMABAACAAIAAgABAAIAAgADAAAAAAAAAAAAAAD///7//v/9//z//P/7//v//f/8//z//P/8//v//v/7//j/+//6//r//P/7//v//f/7//v/+v/5//n/+f/4//n/+v/6//j/+f/9//v/+v/7//r/+//7//z//v/9//z///////////////////8AAAAAAAAAAP7/AAD//wAA////////AAAAAP//AAAAAP//AAD+//z//P/6//3//v/8//3//f/9//3//v/9//z//f/9//3//f/+/////v/+//7///8BAP7///8AAP3//f/+//7//f/+//3//v/+/////////wAA/v/+//3//v////r/+v/7//j/+P/5//f/+P/4//n/+f/6//n/+f/4//n/+f/2//X/9v/2//T/8v/z//T/9P/0//P/8//0//X/8//1//X/9f/2//T/8v/z//b/9//4//n/+v/4//r/+//6//v/+//6//3//f/7//v/+v/6//3/+//7//z/+//9//3//f/+//3//v/+//3//f/8//3//v/9////AAAAAP///v8AAAEAAgACAAIAAQADAAIAAQACAAIAAgACAAEAAQABAAQACAAFAAQABAAEAAUABQAFAAYABQAGAAYABgAFAAUABQAFAAUABgAEAAMAAwAGAAYABgAHAAcABgAIAAcABgAHAAgABwAIAAoACQAJAAkACAAJAAcACAAKAAkACgAJAAoACgAKAAgABwAHAAgACAAHAAcACAAIAAkACgAGAAUABgAGAAUABgAFAAcABwAFAAUABQAEAAQAAgADAAEAAgACAAEAAQAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAQABAAAAAAAAAAEAAAABAAMAAQADAAIAAgABAAEAAQAAAAAAAAAAAAAAAAAAAAAAAAD+/wAAAQAAAP//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//8AAAAAAAABAP////8BAAAAAAAAAAAAAAAAAAEAAQABAAIAAgACAAMAAwADAAEAAwAEAAQABQAEAAYABgAFAAYACAAHAAkABwAKAAgACgAKAAoACgAHAAkABgAIAAgABwAIAAcACAAGAAYABgAGAAUABgAFAAYAAwADAAYABgAFAAUABAAEAAMABAADAAQAAwACAAQAAgADAAIAAgADAAIAAgAFAAMAAQACAAAAAgAAAAAAAAABAAAAAAAAAAAAAAAAAAAA/////wAA///+//7////9//7//v////7//v/+//7//f/9//3//f/9//z//P/9////+//6//v/+v/7//r/+//7//r/+f/6//r/+v/6//r/+f/6//r/+v/5//j/+v/6//r/+v/7//r/+//6//f/9v/2//f/9v/3//X/9v/0//b/8//z//P/8v/z//L/8v/y//P/8//y//D/8f/y//H/8f/x//D/8P/0//P/8v/x//L/8f/w//D/8f/w//D/7//v/+//8P/u/+//7v/s/+3/6v/r/+7/7f/u/+3/7f/s/+z/6//r/+r/7P/q/+v/6//r/+r/6//r/+v/7f/s/+z/7P/t/+7/7v/u/+//7//t//D/7//v/+7/7//v/+//8P/v//P/8f/x//D/8f/x//D/8f/x//L/8f/y//L/8v/z//P/8//0//T/9P/0//X/9f/1//X/9f/2//b/9f/2//b/9f/2//f/9//3//f/9//4//n/9//4//r/+f/7//v//f/8//3//P/+/////v/9//7//v//////////////////////////////AAAAAP7//v/////////+////////////AAD9//v//v/7//3//v/+//////////7//f/+//7//f/9//3//f/+////////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/////wAAAAABAAEAAAABAAAAAAAAAAAA//////7///8AAP7//f////7//v/+//3//f/6//z////+//7////9//z//f/6//v//f/8//3//f/9//7//P/+//7/AAAAAP//AAAAAAAA//8AAAAAAAAAAP///f/+//3//v////7//v8AAAAA/v/+//7//v/+//7//v/9//z//v/+//3//P/7//z//P/8//z////9//7/AAD//wAAAAAAAAAAAAAAAAEAAAABAAEAAgADAAQABAAGAAUABQAGAAYABgAGAAUABQAEAAUABAAEAAQABQAGAAYABQAGAAcABQAIAAEAAgAEAAQABQAFAAUABQAFAAUABgAEAAUABQAFAAUABQAGAAYABgAFAAUABgAGAAYABQAFAAUABQAFAAYABQAFAAQABAAFAAIABAADAAMAAAD+/wAA/v////3//v/9//z//f/7//v/+//6//v/+v/6//v/+v/6//n/+v/5//n/+f/5//n/+P/5//r/+f/5//n/+P/5//n/+f/5//n/9//3//r/+f/4//n/+P/5//j/+f/6//n/+f/5//n/+f/6//n/+v/6//r/+//7//r/+v/6//r/+v/6//n/+//7//v/+f/6//r/+//8//3//f/9//3/+//8//v/+//8//v//P/8//z//f/9//z//P/9//z//P/7//z/+v/9///////9//3//f/+//7//f///wAA/v8AAP//AAAAAP//AAAAAAAAAAAAAAEAAQABAAAAAgABAAEAAgAAAAMABAAEAAUABAAEAAQAAwAEAAcABgAFAAUABAAFAAQABgAEAAYABwAHAAgACAAIAAgACQAJAAoACQAIAAkACQALAAsADAANAA0ADAALAAwADQAOAAwADQAMAAwADAALAAsACwAMAAsACwAMAAsADAAMAAsADAANAAsACwALAAsACwALAAwACgAMAAwACwAJAAsACgAKAAoACgAKAAkACgAKAAoACQAJAAkACQAJAAcABwAHAAcABwAHAAcABwAHAAYABQAGAAUABQAEAAMAAwADAAIAAwABAAQAAgD8//3//P/9//3//f/8//3//P/8//v/+//7//v/+//7//v/+//6//r/+//7//r/+v/7//r/+v/7//r/+v/7//v/+//7//r/+//7//v/+//9//z/+//8//z//P/8//z//P/8//v//f/9//z//f/8//3//f/8//z//P/7//z/+//7//z/+//7//v//P/6//v//f/9//3//f/9//3//P/8//n//P/9//3//v/9//7//////wAAAAD//wAAAAAAAAEAAQACAAIABAAFAAMAAQACAAMAAgADAAQAAwAEAAUABwAGAAYABgAGAAcABgAHAAcABwAHAAgACAAHAAgACAAIAAgACQAKAAsACwALAAwACwALAA0ACwAIAAkADAANAA0ADgAOAA4A';
window.AudioHandler = new AudioHandler();