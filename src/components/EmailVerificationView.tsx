import { useState } from 'react';
import { Mail, CheckCircle2, RefreshCw, LogOut, ShieldAlert, ArrowRight } from 'lucide-react';

interface EmailVerificationViewProps {
  userEmail: string;
  onCheckVerification: () => Promise<void>;
  onResendEmail: () => Promise<void>;
  onSignOut: () => void;
}

export default function EmailVerificationView({
  userEmail,
  onCheckVerification,
  onResendEmail,
  onSignOut
}: EmailVerificationViewProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleCheck = async () => {
    setIsChecking(true);
    try {
      await onCheckVerification();
    } finally {
      setIsChecking(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      await onResendEmail();
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-neutral-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white border-3 sm:border-4 border-black rounded-2xl sm:rounded-3xl shadow-[8px_8px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col my-auto">
        
        {/* Top Accent Bar */}
        <div className="bg-[#00E181] h-3 w-full border-b-2 border-black"></div>

        <div className="p-6 sm:p-8 flex flex-col gap-6 items-center text-center">
          
          {/* Animated Mail Icon Box */}
          <div className="relative">
            <div className="w-16 h-16 bg-[#00E181] border-3 border-black rounded-2xl flex items-center justify-center shadow-[4px_4px_0px_rgba(0,0,0,1)] text-black">
              <Mail className="w-8 h-8 stroke-[2.5]" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-amber-400 border-2 border-black p-1 rounded-full text-black">
              <ShieldAlert className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-black text-[#00AF62] tracking-wider uppercase">
              Action Required
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
              Verify Your Email Address
            </h1>
            <p className="text-xs font-bold text-neutral-600 leading-relaxed max-w-xs mx-auto">
              We sent a verification link to{' '}
              <span className="font-extrabold text-neutral-900 underline font-mono bg-neutral-100 px-1.5 py-0.5 rounded">
                {userEmail}
              </span>
              . You must verify your email before proceeding to the main portal.
            </p>
          </div>

          {/* Alert Notice */}
          <div className="w-full bg-amber-50 border-2 border-black p-3.5 rounded-xl text-left flex items-start gap-2.5 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex flex-col text-[11px] font-bold text-amber-950 leading-tight gap-1">
              <span>Check your inbox or spam folder for the link.</span>
              <span className="text-neutral-600 font-medium text-[10px]">
                Once you click the link in your email, return here and click <strong>"I've Verified My Email"</strong> below.
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full flex flex-col gap-3 pt-2">
            
            {/* Primary Action: Check Verification */}
            <button
              type="button"
              onClick={handleCheck}
              disabled={isChecking}
              className="w-full bg-[#00E181] hover:bg-[#00c973] disabled:opacity-50 text-black border-2 border-black py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] active:translate-y-[1px] flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span>{isChecking ? 'Checking status...' : "I've Verified My Email"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Secondary Action: Resend Link */}
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="w-full bg-white hover:bg-neutral-50 border-2 border-black py-2.5 rounded-xl font-black text-xs uppercase text-neutral-900 transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
              <span>{isResending ? 'Sending...' : 'Resend Verification Email'}</span>
            </button>

            {/* Logout Action */}
            <button
              type="button"
              onClick={onSignOut}
              className="w-full bg-neutral-100 hover:bg-neutral-200 border-2 border-black py-2 rounded-xl font-black text-[11px] uppercase text-neutral-700 transition-all shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-1.5 cursor-pointer mt-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Back to Login / Exit</span>
            </button>

          </div>

        </div>
      </div>
    </div>
  );
}
