import React from "react";

export const DrawOutlineButton = ({ 
  children, 
  className = '',
  disabled = false,
  ...rest 
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  return (
    <button
      {...rest}
      disabled={disabled}
      className={`group relative px-4 py-4 w-full font-display font-bold tracking-wider uppercase transition-colors duration-[400ms] !text-white bg-[#2f1b41] ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[#3d2554]'} ${className}`}
    >
      <span className="relative z-10">{children}</span>

      {/* TOP */}
      <span className="absolute left-0 top-0 h-[2px] w-0 bg-[#e0ccff] transition-all duration-100 group-hover:w-full" />

      {/* RIGHT */}
      <span className="absolute right-0 top-0 h-0 w-[2px] bg-[#e0ccff] transition-all delay-100 duration-100 group-hover:h-full" />

      {/* BOTTOM */}
      <span className="absolute bottom-0 right-0 h-[2px] w-0 bg-[#e0ccff] transition-all delay-200 duration-100 group-hover:w-full" />

      {/* LEFT */}
      <span className="absolute bottom-0 left-0 h-0 w-[2px] bg-[#e0ccff] transition-all delay-300 duration-100 group-hover:h-full" />
    </button>
  );
};
