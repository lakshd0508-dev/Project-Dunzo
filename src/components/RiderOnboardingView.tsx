import { useState, FormEvent } from 'react';
import { 
  Bike, 
  ShieldCheck, 
  Plus, 
  Trash2, 
  FileCheck, 
  LogOut, 
  AlertCircle, 
  Phone, 
  CheckCircle2, 
  ArrowRight,
  UserCheck
} from 'lucide-react';
import { UserProfile, INDIAN_STATES } from '../types';

interface RiderOnboardingViewProps {
  currentUser: UserProfile;
  onSaveProfile: (updatedProfile: UserProfile) => Promise<void>;
  onSignOut: () => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

// Vehicle Registration Number Auto-Formatter: XX-00-AB-0000 (e.g. KA-05-AB-1234)
const formatLicenseNumber = (raw: string): string => {
  const clean = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10);
  let formatted = '';
  if (clean.length > 0) formatted += clean.slice(0, 2);
  if (clean.length > 2) formatted += '-' + clean.slice(2, 4);
  if (clean.length > 4) formatted += '-' + clean.slice(4, 6);
  if (clean.length > 6) formatted += '-' + clean.slice(6, 10);
  return formatted;
};

// Vehicle Registration Number Regex Validator: 2 letters - 2 numbers - 1-2 letters/numbers - 4 numbers
const validateLicenseNumber = (lic: string): { isValid: boolean; error?: string } => {
  const clean = lic.trim().toUpperCase();
  if (!clean) {
    return { isValid: false, error: 'Vehicle Registration Number is required.' };
  }
  
  const parts = clean.split('-');
  if (parts.length !== 4) {
    return { 
      isValid: false, 
      error: 'Invalid Vehicle Registration Number format! Required format: XX-00-AB-0000 (e.g. KA-05-AB-1234).' 
    };
  }

  const [p1, p2, p3, p4] = parts;

  if (!/^[A-Z]{2}$/.test(p1)) {
    return { isValid: false, error: 'Vehicle Registration error: First 2 characters must be state code letters (e.g. KA, MH, TN).' };
  }

  if (!/^\d{2}$/.test(p2)) {
    return { isValid: false, error: 'Vehicle Registration error: Second 2 characters must be 2 digits (e.g. 05, 12).' };
  }

  if (!/^[A-Z0-9]{1,2}$/.test(p3)) {
    return { isValid: false, error: 'Vehicle Registration error: 3rd part must contain 1-2 letters/digits (e.g. AB or A1).' };
  }

  if (!/^\d{4}$/.test(p4)) {
    return { isValid: false, error: 'Vehicle Registration error: Last part must be 4 digits (e.g. 1234).' };
  }

  return { isValid: true };
};

export default function RiderOnboardingView({
  currentUser,
  onSaveProfile,
  onSignOut,
  showToast
}: RiderOnboardingViewProps) {
  const [phone, setPhone] = useState(
    currentUser.phone ? currentUser.phone.replace('+91', '') : ''
  );
  const [city, setCity] = useState(currentUser.city || '');
  const [stateName, setStateName] = useState(currentUser.state || '');
  const [pincode, setPincode] = useState(currentUser.pincode || '');
  const [riderVehicles, setRiderVehicles] = useState<string[]>(
    currentUser.vehicles || []
  );
  const [vehicleInput, setVehicleInput] = useState('');
  const [riderLicense, setRiderLicense] = useState(
    currentUser.licenseNumber ? formatLicenseNumber(currentUser.licenseNumber) : ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);

  const handleAddVehicle = () => {
    const trimmed = vehicleInput.trim();
    if (!trimmed) {
      showToast('Please type a vehicle brand/model (e.g. Activa 6G, Honda Splendor, Ather 450)', 'error');
      return;
    }
    if (riderVehicles.length >= 1) {
      showToast('Maximum 1 registered vehicle allowed for delivery partners!', 'error');
      return;
    }
    setRiderVehicles([trimmed]);
    setVehicleInput('');
    showToast(`Vehicle "${trimmed}" registered successfully!`, 'success');
  };

  const handleRemoveVehicle = (index: number) => {
    setRiderVehicles(prev => prev.filter((_, i) => i !== index));
    showToast('Vehicle removed.', 'info');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);

    const cleanPhone = phone.trim().replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      showToast('Please enter a valid 10-digit mobile number!', 'error');
      return;
    }

    let finalVehicles = [...riderVehicles];
    if (vehicleInput.trim() && finalVehicles.length === 0) {
      finalVehicles.push(vehicleInput.trim());
    }

    if (finalVehicles.length === 0) {
      showToast('Please add 1 registered vehicle (e.g. Activa 6G, Honda Splendor) to proceed!', 'error');
      return;
    }

    if (finalVehicles.length > 1) {
      showToast('Maximum 1 vehicle allowed!', 'error');
      return;
    }

    if (!riderLicense.trim()) {
      showToast('Please enter your Vehicle Registration Number!', 'error');
      return;
    }

    const licValidation = validateLicenseNumber(riderLicense);
    if (!licValidation.isValid) {
      showToast(licValidation.error!, 'error');
      return;
    }

    if (!city.trim()) {
      showToast('Please enter your operating City!', 'error');
      return;
    }

    if (!stateName.trim()) {
      showToast('Please select your operating State!', 'error');
      return;
    }

    if (!pincode.trim() || pincode.trim().length !== 6 || !/^\d{6}$/.test(pincode.trim())) {
      showToast('Please enter a valid 6-digit PIN code!', 'error');
      return;
    }

    setIsSubmitting(true);

    const updatedProfile: UserProfile = {
      ...currentUser,
      phone: '+91' + cleanPhone,
      city: city.trim(),
      state: stateName.trim(),
      pincode: pincode.trim(),
      vehicles: finalVehicles,
      licenseNumber: riderLicense.trim(),
      userRole: 'rider',
      address: `Rider Partner Hub, ${city.trim()}, ${stateName.trim()} - ${pincode.trim()}`
    };

    try {
      await onSaveProfile(updatedProfile);
    } catch (err: any) {
      console.error('Error completing rider onboarding:', err);
      showToast('Failed to save profile. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-neutral-100 flex items-center justify-center p-3 sm:p-6 md:p-8 font-sans">
      <div className="w-full max-w-lg bg-white border-3 sm:border-4 border-black rounded-2xl sm:rounded-3xl shadow-[8px_8px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col my-auto">
        
        {/* Top Accent Bar */}
        <div className="bg-amber-400 h-2.5 w-full border-b-2 border-black"></div>

        <div className="p-5 sm:p-8 flex flex-col gap-5">
          
          {/* Header Row */}
          <div className="flex items-center justify-between border-b-2 border-dashed border-neutral-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-black p-2.5 rounded-xl border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] text-amber-400">
                <Bike className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-amber-600 tracking-wider uppercase leading-none mb-1">
                  MANDATORY ONBOARDING
                </span>
                <span className="text-sm font-black text-neutral-900 tracking-tight leading-none">
                  Delivery Partner Verification
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onSignOut}
              className="flex items-center gap-1 px-2.5 py-1.5 border-2 border-black bg-white hover:bg-neutral-100 rounded-lg text-[10px] font-black uppercase text-neutral-800 transition-all shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)] cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>

          {/* User welcome message */}
          <div className="bg-amber-50 border-2 border-black p-3.5 rounded-2xl flex items-start gap-3 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            <UserCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5 text-xs">
              <span className="font-black text-neutral-900 uppercase">
                Welcome, {currentUser.name || currentUser.email.split('@')[0]}!
              </span>
              <p className="text-neutral-600 text-[11px] leading-relaxed">
                For account transparency, road safety compliance, and delivery dispatching, please register your vehicle and vehicle registration number before accessing the partner network.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            {/* 1. MOBILE NUMBER */}
            <div>
              <label className="text-[10px] font-black text-neutral-500 tracking-wider uppercase mb-1 block">
                MOBILE NUMBER *
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-neutral-400">
                  <Phone className="w-4 h-4" />
                </span>
                <span className="absolute left-9 text-xs font-black text-neutral-900 border-r-2 border-neutral-200 pr-2 h-5 flex items-center select-none">
                  +91
                </span>
                <input
                  type="tel"
                  minLength={10}
                  maxLength={10}
                  pattern="[0-9]{10}"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  required
                  className={`w-full pl-20 pr-3.5 py-2.5 text-xs font-bold border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white text-neutral-900 ${
                    (phone.length > 0 && phone.length < 10) || (formSubmitted && phone.length === 0) ? 'border-red-500 bg-red-50/20' : 'border-black'
                  }`}
                />
              </div>
              {phone.length > 0 && phone.length < 10 && (
                <p className="text-[11px] font-bold text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Mobile number must be 10 digits ({phone.length}/10 digits entered).</span>
                </p>
              )}
              {formSubmitted && phone.length === 0 && (
                <p className="text-[11px] font-bold text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>10-digit mobile number is required.</span>
                </p>
              )}
            </div>

            {/* OPERATING LOCATION DETAILS (CITY, STATE, PINCODE) */}
            <div className="flex flex-col gap-3 p-3.5 bg-neutral-50 border-2 border-black rounded-2xl shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">
                PRIMARY OPERATING LOCATION *
              </span>

              {/* City + PIN Code Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-neutral-500 tracking-wider uppercase mb-1 block">CITY *</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Bengaluru"
                    className={`w-full px-3 py-2 text-xs font-bold border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white transition-all text-neutral-900 ${
                      formSubmitted && !city.trim() ? 'border-red-500 bg-red-50/20' : 'border-black'
                    }`}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-neutral-500 tracking-wider uppercase mb-1 block">PIN CODE (6 DIGITS) *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="560103"
                    className={`w-full px-3 py-2 text-xs font-mono font-bold border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white transition-all text-neutral-900 ${
                      formSubmitted && (pincode.length !== 6 || !/^\d{6}$/.test(pincode)) ? 'border-red-500 bg-red-50/20' : 'border-black'
                    }`}
                  />
                </div>
              </div>

              {/* State Dropdown Select */}
              <div>
                <label className="text-[10px] font-black text-neutral-500 tracking-wider uppercase mb-1 block">SELECT STATE *</label>
                <select
                  required
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  className={`w-full px-3 py-2 text-xs font-bold border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white transition-all text-neutral-900 ${
                    formSubmitted && !stateName.trim() ? 'border-red-500 bg-red-50/20' : 'border-black'
                  }`}
                >
                  <option value="">-- Select State --</option>
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
                {formSubmitted && !stateName.trim() && (
                  <p className="text-[11px] font-bold text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Operating state selection is mandatory.</span>
                  </p>
                )}
              </div>
            </div>

            {/* 2. VEHICLE REGISTRATION (MAX 1 ALLOWED) */}
            <div className="flex flex-col gap-3 border-2 border-black rounded-2xl p-4 bg-amber-50/50 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              
              <div className="flex items-start gap-2 bg-amber-100 border border-amber-300 p-2 rounded-xl text-xs text-amber-900 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-tight">
                  Delivery partners can register <strong>only 1 vehicle</strong> (e.g. Activa 6G, Honda Splendor, Ather).
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-black text-neutral-700 tracking-wider uppercase flex items-center gap-1">
                    <Bike className="w-3.5 h-3.5 text-amber-600" />
                    <span>REGISTERED VEHICLE * (MAX 1 ALLOWED)</span>
                  </label>
                  <span className="text-[10px] font-black text-amber-800 font-mono">
                    {riderVehicles.length}/1 Registered
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={vehicleInput}
                    onChange={(e) => setVehicleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddVehicle();
                      }
                    }}
                    disabled={riderVehicles.length >= 1}
                    placeholder={riderVehicles.length >= 1 ? "Maximum 1 vehicle registered" : "e.g. Activa 6G, Honda Splendor, Ather"}
                    className="flex-1 px-3.5 py-2.5 text-xs font-bold border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddVehicle}
                    disabled={riderVehicles.length >= 1}
                    className="px-3.5 py-2.5 bg-amber-400 hover:bg-amber-500 disabled:bg-neutral-200 text-black border-2 border-black rounded-xl font-black text-xs uppercase flex items-center gap-1 transition-all shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)] cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>Add</span>
                  </button>
                </div>

                {riderVehicles.length === 0 && (
                  <div className="mt-1.5 p-2 bg-amber-100 border-2 border-amber-400 rounded-xl text-amber-950 text-[11px] font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-700" />
                    <span>Type a vehicle name above & click Add (e.g. Activa 6G, Honda Splendor).</span>
                  </div>
                )}

                {riderVehicles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {riderVehicles.map((v, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-white border-2 border-black px-3 py-1.5 rounded-xl shadow-[2px_2px_0px_rgba(0,0,0,1)] text-xs font-black">
                        <Bike className="w-3.5 h-3.5 text-amber-600" />
                        <span>Vehicle: {v}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveVehicle(idx)}
                          className="text-red-500 hover:text-red-700 ml-1 p-0.5 cursor-pointer"
                          title="Remove vehicle"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. VEHICLE REGISTRATION NUMBER VERIFICATION */}
              <div>
                <label className="text-[10px] font-black text-neutral-700 tracking-wider uppercase mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>VEHICLE REGISTRATION NUMBER *</span>
                  </span>
                  <span className="font-mono text-[9px] text-neutral-500">FORMAT: XX-00-AB-0000</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                    <ShieldCheck className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={riderLicense}
                    onChange={(e) => setRiderLicense(formatLicenseNumber(e.target.value))}
                    placeholder="e.g. KA-05-AB-1234"
                    maxLength={13}
                    required
                    className={`w-full pl-10 pr-3.5 py-2.5 text-xs font-mono font-bold border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white text-neutral-900 uppercase ${
                      riderLicense.trim().length > 0 && !validateLicenseNumber(riderLicense).isValid ? 'border-red-500 bg-red-50/20' : 'border-black'
                    }`}
                  />
                  {validateLicenseNumber(riderLicense).isValid && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                  )}
                </div>

                {/* Inline Vehicle Registration Error / Success Box */}
                {riderLicense.trim().length > 0 && !validateLicenseNumber(riderLicense).isValid && (
                  <div className="mt-2 p-2.5 bg-red-50 border-2 border-red-500 rounded-xl text-red-700 text-[11px] font-bold flex items-start gap-2 shadow-[2px_2px_0px_rgba(239,68,68,1)]">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                    <div className="flex flex-col gap-0.5">
                      <span className="font-black uppercase text-[10px] tracking-wider text-red-800">Invalid Registration Format</span>
                      <span className="leading-tight">{validateLicenseNumber(riderLicense).error}</span>
                    </div>
                  </div>
                )}

                {riderLicense.trim().length > 0 && validateLicenseNumber(riderLicense).isValid && (
                  <div className="mt-2 p-2 bg-emerald-50 border-2 border-emerald-500 rounded-xl text-emerald-800 text-[11px] font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>Valid Vehicle Registration Number Format (e.g. KA-05-AB-1234)</span>
                  </div>
                )}

                {formSubmitted && !riderLicense.trim() && (
                  <p className="text-[11px] font-bold text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Vehicle registration number is required for verification.</span>
                  </p>
                )}
              </div>

            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-amber-400 hover:bg-amber-500 border-2 border-black py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] active:translate-y-[1px] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Verifying Details...' : 'Complete Partner Setup & Proceed'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

          </form>

        </div>
      </div>
    </div>
  );
}
