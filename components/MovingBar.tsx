'use client';

export default function MovingBar() {
  const message = "Participa ahora por un Coleccionable Lego McLaren P1";
  // Repeat the message enough times to ensure seamless scrolling (10 times for safety)
  const repeatedMessage = Array(10).fill(message).join(' --- ');

  return (
    <div className="announcement-bar">
      <div className="announcement-text">
        {repeatedMessage}
      </div>
    </div>
  );
}