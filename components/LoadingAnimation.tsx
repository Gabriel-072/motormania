// components/LoadingAnimation.tsx
import Head from 'next/head';

interface LoadingAnimationProps {
  text?: string;
  animationDuration?: number;
}

export default function LoadingAnimation({
  text = '¡Preparando la pista...',
  animationDuration = 3,
}: LoadingAnimationProps) {
  return (
    <>
      <Head>
        <style>{`
          .spinner {
            background-image: linear-gradient(rgb(186, 66, 255) 35%, rgb(0, 225, 255));
            width: 100px;
            height: 100px;
            animation: spinning82341 1.7s linear infinite;
            text-align: center;
            border-radius: 50px;
            filter: blur(1px);
            box-shadow: 0px -5px 20px 0px rgb(186, 66, 255), 0px 5px 20px 0px rgb(0, 225, 255);
          }

          .spinner1 {
            background-color: rgb(36, 36, 36);
            width: 100px;
            height: 100px;
            border-radius: 50px;
            filter: blur(10px);
          }

          @keyframes spinning82341 {
            to {
              transform: rotate(360deg);
            }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>
      </Head>
      <div className="flex items-center justify-center min-h-[calc(100vh-5rem)]">
        <div className="flex flex-col items-center justify-center">
          <div className="spinner">
            <div className="spinner1"></div>
          </div>
          <p className="text-amber-400 text-xl font-exo2 mt-4 opacity-0 animate-[fadeIn_0.5s_ease-in_forwards]">
            {text}
          </p>
        </div>
      </div>
    </>
  );
}