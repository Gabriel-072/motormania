declare module 'canvas-confetti' {
    interface CanvasConfettiOptions {
      particleCount?: number;
      spread?: number;
      scalar?: number;
      origin?: { x?: number; y?: number; };
      [key: string]: any;
    }
    function confetti(opts?: CanvasConfettiOptions): void;
    export default confetti;
  }