// Beat Detection and Audio Analysis for YT Looper
// Real-time transient detection and BPM analysis

export class BeatDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  
  // Detection parameters
  private sampleRate = 44100;
  private bufferSize = 2048;
  private hopSize = 512; // Overlap for better resolution
  
  // Beat tracking state
  private peaks: number[] = [];
  private beatTimes: number[] = [];
  private spectralFlux: number[] = [];
  private previousSpectrum: Float32Array | null = null;
  
  // BPM detection
  private detectedBPM: number = 120;
  private confidence: number = 0;
  
  constructor() {
    this.initAudioContext();
  }
  
  private async initAudioContext(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.sampleRate = this.audioContext.sampleRate;
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error);
    }
  }
  
  /**
   * Connect to media element and start analysis
   */
  public async connectToMedia(mediaElement: HTMLMediaElement): Promise<void> {
    if (!this.audioContext) {
      await this.initAudioContext();
    }
    
    if (!this.audioContext) {
      throw new Error('AudioContext not available');
    }
    
    // Clean up existing connections
    this.disconnect();
    
    try {
      // Create audio nodes
      this.source = this.audioContext.createMediaElementSource(mediaElement);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.bufferSize;
      this.analyser.smoothingTimeConstant = 0.1; // Low smoothing for transient detection
      
      // Create script processor for real-time analysis
      this.scriptProcessor = this.audioContext.createScriptProcessor(this.bufferSize, 1, 1);
      this.scriptProcessor.onaudioprocess = this.processAudio.bind(this);
      
      // Connect nodes: source -> analyser -> scriptProcessor -> destination
      this.source.connect(this.analyser);
      this.analyser.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);
      
      // Also connect source directly to destination for audio playback
      this.source.connect(this.audioContext.destination);
      
    } catch (error) {
      console.error('Failed to connect to media:', error);
      throw error;
    }
  }
  
  /**
   * Process audio in real-time for beat detection
   */
  private processAudio(event: AudioProcessingEvent): void {
    if (!this.analyser) return;
    
    const inputBuffer = event.inputBuffer;
    const inputData = inputBuffer.getChannelData(0);
    
    // Get frequency data
    const frequencyData = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatFrequencyData(frequencyData);
    
    // Calculate spectral flux (change in frequency content)
    const flux = this.calculateSpectralFlux(frequencyData);
    this.spectralFlux.push(flux);
    
    // Detect peaks in spectral flux (potential beats)
    if (this.isPeak(flux)) {
      const currentTime = this.audioContext!.currentTime;
      this.beatTimes.push(currentTime);
      this.peaks.push(flux);
      
      // Update BPM estimate
      this.updateBPMEstimate();
    }
    
    // Keep only recent data (last 10 seconds)
    this.pruneOldData();
    
    // Pass through audio unchanged
    const outputBuffer = event.outputBuffer;
    for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
      const outputData = outputBuffer.getChannelData(channel);
      if (channel === 0) {
        outputData.set(inputData);
      } else {
        outputData.fill(0); // Silent for other channels
      }
    }
  }
  
  /**
   * Calculate spectral flux (sum of positive differences)
   */
  private calculateSpectralFlux(spectrum: Float32Array): number {
    let flux = 0;
    
    if (this.previousSpectrum) {
      // Focus on low frequencies (0-500Hz) for beat detection
      const maxBin = Math.floor(500 * this.bufferSize / this.sampleRate);
      
      for (let i = 0; i < maxBin; i++) {
        const diff = spectrum[i] - this.previousSpectrum[i];
        if (diff > 0) {
          flux += diff;
        }
      }
    }
    
    this.previousSpectrum = new Float32Array(spectrum);
    return flux;
  }
  
  /**
   * Detect if current flux is a peak (beat)
   */
  private isPeak(flux: number): boolean {
    if (this.spectralFlux.length < 10) return false;
    
    // Dynamic threshold based on recent history
    const recentFlux = this.spectralFlux.slice(-20);
    const mean = recentFlux.reduce((a, b) => a + b, 0) / recentFlux.length;
    const variance = recentFlux.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentFlux.length;
    const stdDev = Math.sqrt(variance);
    
    // Peak if flux exceeds mean + 1.5 * standard deviation
    const threshold = mean + 1.5 * stdDev;
    
    // Also check for local maximum
    const isLocalMax = this.spectralFlux.length >= 3 &&
      flux > this.spectralFlux[this.spectralFlux.length - 2] &&
      flux > this.spectralFlux[this.spectralFlux.length - 3];
    
    return flux > threshold && isLocalMax;
  }
  
  /**
   * Update BPM estimate based on beat intervals
   */
  private updateBPMEstimate(): void {
    if (this.beatTimes.length < 4) return;
    
    // Get recent beat intervals
    const recentBeats = this.beatTimes.slice(-16); // Last 16 beats
    const intervals: number[] = [];
    
    for (let i = 1; i < recentBeats.length; i++) {
      intervals.push(recentBeats[i] - recentBeats[i - 1]);
    }
    
    // Find most common interval using autocorrelation
    const bpm = this.estimateBPMFromIntervals(intervals);
    
    if (bpm > 0) {
      // Smooth BPM estimate
      this.detectedBPM = this.detectedBPM * 0.7 + bpm * 0.3;
      
      // Calculate confidence based on interval consistency
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((a, b) => a + Math.pow(b - avgInterval, 2), 0) / intervals.length;
      this.confidence = Math.max(0, 1 - (Math.sqrt(variance) / avgInterval));
    }
  }
  
  /**
   * Estimate BPM from beat intervals using autocorrelation
   */
  private estimateBPMFromIntervals(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    // Calculate average interval
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    
    // Convert to BPM (assuming quarter note beats)
    const bpm = 60 / avgInterval;
    
    // Constrain to reasonable range
    if (bpm < 60) return bpm * 2; // Likely half-time
    if (bpm > 180) return bpm / 2; // Likely double-time
    
    return bpm;
  }
  
  /**
   * Quantize a time value to nearest beat
   */
  public quantizeToNearestBeat(time: number): number {
    if (this.beatTimes.length === 0) {
      // No beats detected, quantize to estimated grid
      const beatInterval = 60 / this.detectedBPM;
      return Math.round(time / beatInterval) * beatInterval;
    }
    
    // Find nearest detected beat
    let nearestBeat = this.beatTimes[0];
    let minDistance = Math.abs(time - nearestBeat);
    
    for (const beatTime of this.beatTimes) {
      const distance = Math.abs(time - beatTime);
      if (distance < minDistance) {
        minDistance = distance;
        nearestBeat = beatTime;
      }
    }
    
    return nearestBeat;
  }
  
  /**
   * Quantize loop points to musical boundaries
   */
  public quantizeLoop(pointA: number, pointB: number): { a: number, b: number, bars: number } {
    const beatInterval = 60 / this.detectedBPM;
    const barLength = beatInterval * 4; // 4 beats per bar
    
    // Quantize point A to nearest beat
    const quantizedA = this.quantizeToNearestBeat(pointA);
    
    // Calculate loop length in bars
    const loopLength = pointB - pointA;
    const barsFloat = loopLength / barLength;
    const bars = Math.round(barsFloat);
    
    // Quantize point B to complete bars from A
    const quantizedB = quantizedA + (bars * barLength);
    
    return {
      a: quantizedA,
      b: quantizedB,
      bars: bars
    };
  }
  
  /**
   * Get current BPM and confidence
   */
  public getBPMInfo(): { bpm: number, confidence: number } {
    return {
      bpm: Math.round(this.detectedBPM),
      confidence: this.confidence
    };
  }
  
  /**
   * Get beat grid for visualization
   */
  public getBeatGrid(startTime: number, endTime: number): number[] {
    const beatInterval = 60 / this.detectedBPM;
    const grid: number[] = [];
    
    // Start from nearest beat before startTime
    let currentBeat = Math.floor(startTime / beatInterval) * beatInterval;
    
    while (currentBeat <= endTime) {
      if (currentBeat >= startTime) {
        grid.push(currentBeat);
      }
      currentBeat += beatInterval;
    }
    
    return grid;
  }
  
  /**
   * Clean up old data
   */
  private pruneOldData(): void {
    const currentTime = this.audioContext!.currentTime;
    const cutoffTime = currentTime - 10; // Keep last 10 seconds
    
    // Remove old beat times
    while (this.beatTimes.length > 0 && this.beatTimes[0] < cutoffTime) {
      this.beatTimes.shift();
      this.peaks.shift();
    }
    
    // Limit spectral flux buffer
    if (this.spectralFlux.length > 1000) {
      this.spectralFlux = this.spectralFlux.slice(-500);
    }
  }
  
  /**
   * Disconnect and clean up
   */
  public disconnect(): void {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor.onaudioprocess = null;
      this.scriptProcessor = null;
    }
    
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    
    this.peaks = [];
    this.beatTimes = [];
    this.spectralFlux = [];
    this.previousSpectrum = null;
  }
  
  /**
   * Manual tap tempo input
   */
  private tapTimes: number[] = [];
  
  public tap(): number {
    const now = Date.now() / 1000;
    this.tapTimes.push(now);
    
    // Keep only recent taps (last 8)
    if (this.tapTimes.length > 8) {
      this.tapTimes.shift();
    }
    
    // Need at least 2 taps to calculate BPM
    if (this.tapTimes.length < 2) {
      return 0;
    }
    
    // Calculate average interval
    const intervals: number[] = [];
    for (let i = 1; i < this.tapTimes.length; i++) {
      intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = 60 / avgInterval;
    
    // Update detected BPM if taps are consistent
    const variance = intervals.reduce((a, b) => a + Math.pow(b - avgInterval, 2), 0) / intervals.length;
    if (Math.sqrt(variance) < avgInterval * 0.1) { // Less than 10% variation
      this.detectedBPM = bpm;
      this.confidence = 0.9; // High confidence for manual taps
    }
    
    return bpm;
  }
  
  public resetTapTempo(): void {
    this.tapTimes = [];
  }
}