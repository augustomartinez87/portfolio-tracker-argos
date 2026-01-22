const ButterflyCSSBackground = () => {
  return (
    <div className="fixed inset-0 -z-10 bg-black overflow-hidden">
      {/* Mariposa 1 */}
      <div className="butterfly butterfly-1">
        <div className="wing left" />
        <div className="wing right" />
        <div className="body" />
        <div className="antenna left" />
        <div className="antenna right" />
      </div>
      
      {/* Mariposa 2 */}
      <div className="butterfly butterfly-2">
        <div className="wing left" />
        <div className="wing right" />
        <div className="body" />
        <div className="antenna left" />
        <div className="antenna right" />
      </div>
      
      {/* Mariposa 3 */}
      <div className="butterfly butterfly-3">
        <div className="wing left" />
        <div className="wing right" />
        <div className="body" />
        <div className="antenna left" />
        <div className="antenna right" />
      </div>
      
      {/* Mariposa 4 */}
      <div className="butterfly butterfly-4">
        <div className="wing left" />
        <div className="wing right" />
        <div className="body" />
        <div className="antenna left" />
        <div className="antenna right" />
      </div>
      
      {/* Mariposa 5 */}
      <div className="butterfly butterfly-5">
        <div className="wing left" />
        <div className="wing right" />
        <div className="body" />
        <div className="antenna left" />
        <div className="antenna right" />
      </div>
      
      {/* Mariposa 6 */}
      <div className="butterfly butterfly-6">
        <div className="wing left" />
        <div className="wing right" />
        <div className="body" />
        <div className="antenna left" />
        <div className="antenna right" />
      </div>

      <style>{`
        .butterfly {
          position: absolute;
          width: 30px;
          height: 20px;
          animation: fly 15s linear infinite;
        }
        
        .butterfly-1 { left: 10%; top: 20%; animation-delay: 0s; }
        .butterfly-2 { left: 30%; top: 60%; animation-delay: -3s; }
        .butterfly-3 { left: 50%; top: 30%; animation-delay: -6s; }
        .butterfly-4 { left: 70%; top: 70%; animation-delay: -9s; }
        .butterfly-5 { left: 85%; top: 15%; animation-delay: -12s; }
        .butterfly-6 { left: 15%; top: 80%; animation-delay: -2s; }
        
        .body {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 2px;
          height: 16px;
          background: white;
          border-radius: 1px;
          opacity: 0.6;
        }
        
        .wing {
          position: absolute;
          top: 50%;
          width: 14px;
          height: 10px;
          border: 1px solid white;
          background: transparent;
          opacity: 0.4;
          transform-origin: center;
        }
        
        .wing.left {
          right: 50%;
          border-radius: 50% 0 0 50%;
          animation: flapLeft 0.3s ease-in-out infinite alternate;
        }
        
        .wing.right {
          left: 50%;
          border-radius: 0 50% 50% 0;
          animation: flapRight 0.3s ease-in-out infinite alternate;
        }
        
        .antenna {
          position: absolute;
          top: 2px;
          width: 1px;
          height: 6px;
          background: white;
          opacity: 0.4;
        }
        
        .antenna.left {
          right: 52%;
          transform: rotate(-30deg);
          transform-origin: bottom;
        }
        
        .antenna.right {
          left: 52%;
          transform: rotate(30deg);
          transform-origin: bottom;
        }
        
        @keyframes flapLeft {
          from { transform: translateX(2px) rotateY(0deg); }
          to { transform: translateX(4px) rotateY(-30deg); }
        }
        
        @keyframes flapRight {
          from { transform: translateX(-2px) rotateY(0deg); }
          to { transform: translateX(-4px) rotateY(30deg); }
        }
        
        @keyframes fly {
          0% {
            transform: translateX(0) translateY(0) rotate(0deg);
          }
          25% {
            transform: translateX(20vw) translateY(-10px) rotate(5deg);
          }
          50% {
            transform: translateX(40vw) translateY(15px) rotate(-5deg);
          }
          75% {
            transform: translateX(60vw) translateY(-8px) rotate(3deg);
          }
          100% {
            transform: translateX(80vw) translateY(0) rotate(0deg);
          }
        }
      `}</style>
    </div>
  )
}

export default ButterflyCSSBackground
