"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Small delay to ensure loading screen is visible
    const timer = setTimeout(() => {
      router.push("/dashboard");
    }, 100);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-32 h-32">
          {/* Backdrop glow shadow */}
          <div 
            className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse"
            style={{ 
              animationDuration: '2s',
              transform: 'scale(1.4)',
              filter: 'blur(30px)'
            }}
          />
          
          {/* Logo */}
          <div className="relative w-full h-full rounded-full overflow-hidden border border-primary/20">
            <Image
              src="/logos/profile-icon.png"
              alt="Loading"
              width={128}
              height={128}
              className="w-full h-full object-cover rounded-full"
              priority
            />
          </div>
        </div>
      </div>
    </div>
  );
}
