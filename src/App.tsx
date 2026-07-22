import { useState, useEffect, FormEvent } from 'react';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  ArrowRight,
  X,
  Lock,
  LogIn,
  UserPlus,
  Bike,
  ShieldCheck,
  Plus,
  Trash2,
  FileCheck,
  ShoppingBag,
  LogOut,
  AlertCircle,
  CheckCircle2,
  ShoppingCart,
  ArrowLeftRight,
  Shirt,
  HeartHandshake,
  Zap,
  Shield
} from 'lucide-react';
import { UserProfile, INDIAN_STATES } from './types';
import LogisticsDashboard from './components/LogisticsDashboard';
import { ProjectDunzoLogo } from './components/ProjectDunzoLogo';
import RiderOnboardingView from './components/RiderOnboardingView';
import EmailVerificationView from './components/EmailVerificationView';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
  signOut
} from 'firebase/auth';

// Password validation helper according to security policy
const validatePassword = (pass: string): { isValid: boolean; error?: string } => {
  if (pass.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(pass)) {
    return { isValid: false, error: 'Password must contain at least 1 uppercase letter (A-Z).' };
  }
  if (!/[0-9]/.test(pass)) {
    return { isValid: false, error: 'Password must contain at least 1 numeric value (0-9).' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pass)) {
    return { isValid: false, error: 'Password must contain at least 1 special character (e.g. @, _, #, !, $).' };
  }
  return { isValid: true };
};

// Vehicle Registration Number Auto-Formatter: XX-00-AB-0000 (e.g. KA-05-AB-1234 or KA-05-A1-1234)
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

export default function App() {
  // Session / User profile state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  
  // Landing Page state: initially true when app opens
  const [showLanding, setShowLanding] = useState(true);
  
  // Login Portal selection: 'customer' | 'rider'
  const [selectedPortal, setSelectedPortal] = useState<'customer' | 'rider'>('customer');
  const [isSignUp, setIsSignUp] = useState(true); // Toggle between Register (Sign Up) and Login (Sign In)

  // Form Inputs State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');

  // Rider specific inputs state
  const [riderVehicles, setRiderVehicles] = useState<string[]>([]);
  const [vehicleInput, setVehicleInput] = useState('');
  const [riderLicense, setRiderLicense] = useState('');
  const [formSubmitted, setFormSubmitted] = useState(false);

  // UI Notification State
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Dynamic Firebase Auth state listener to sync active session details on load
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (fbUser) => {
      if (fbUser && fbUser.email) {
        const normalizedEmail = fbUser.email.trim().toLowerCase();
        
        // Retrieve local cache first for instant feedback if matching
        let cachedRole: 'customer' | 'rider' = selectedPortal;
        const cached = localStorage.getItem('dunzo_logistics_session');
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as UserProfile;
            if (parsed && parsed.email === normalizedEmail) {
              if (parsed.userRole) cachedRole = parsed.userRole;
              setCurrentUser(parsed);
              return;
            }
          } catch (err) {
            console.error('Error parsing cached session:', err);
          }
        }

        // Fetch latest profile from Firestore to keep credentials/details updated
        try {
          const profile = await getProfileFromFirestore(normalizedEmail, cachedRole);
          if (profile) {
            setCurrentUser(profile);
            localStorage.setItem('dunzo_logistics_session', JSON.stringify(profile));
          }
        } catch (err: any) {
          console.error('Error fetching profile in auth change listener:', err);
        }
      } else {
        setCurrentUser(null);
        localStorage.removeItem('dunzo_logistics_session');
      }
    });

    return () => unsubscribe();
  }, []);

  // Show a notification helper
  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Vehicle management for riders
  const handleAddVehicle = () => {
    const trimmed = vehicleInput.trim();
    if (!trimmed) {
      showToast('Please type a vehicle brand/type name (e.g. Activa 6G, Honda Splendor, Ather)', 'error');
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

  // Helper to get role collection name
  const getRoleCollection = (role: 'customer' | 'rider') => {
    return role === 'rider' ? 'rider_profiles' : 'customer_profiles';
  };

  // Helper to fetch a profile by email and role from Firestore (with fallbacks)
  const getProfileFromFirestore = async (email: string, targetRole: 'customer' | 'rider'): Promise<UserProfile | null> => {
    const collectionName = getRoleCollection(targetRole);
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Primary check in role-specific collection (customer_profiles or rider_profiles)
    try {
      const roleRef = doc(db, collectionName, normalizedEmail);
      const roleSnap = await getDoc(roleRef);
      if (roleSnap.exists()) {
        return roleSnap.data() as UserProfile;
      }
    } catch (err) {
      console.warn(`Error reading from ${collectionName}:`, err);
    }

    // 2. Fallback check in legacy 'profiles' collection
    try {
      const legacyRef = doc(db, 'profiles', normalizedEmail);
      const legacySnap = await getDoc(legacyRef);
      if (legacySnap.exists()) {
        const data = legacySnap.data() as UserProfile;
        if (data.userRole === targetRole) {
          return data;
        }
      }
    } catch (err) {
      console.warn('Error reading from legacy profiles:', err);
    }

    return null;
  };

  // Determine auth method stored in profile doc (with backwards compatibility)
  const getDocAuthMethod = (data: any): 'google' | 'password' => {
    if (data?.authMethod) return data.authMethod;
    if (data?.password && data.password.trim().length > 0) return 'password';
    return 'google';
  };

  // Helper to check for duplicate profiles in target role or duplicate credentials across existing accounts
  const checkDuplicateProfile = async (
    emailToCheck: string,
    phoneToCheck: string,
    nameToCheck: string,
    licenseToCheck: string | undefined,
    targetRole: 'customer' | 'rider',
    excludeEmail?: string
  ): Promise<{ hasDuplicate: boolean; message?: string }> => {
    try {
      const cleanEmail = emailToCheck.trim().toLowerCase();
      const cleanName = nameToCheck.trim().toLowerCase();
      const cleanLicense = (licenseToCheck || '').trim().toUpperCase();
      const cleanExclude = excludeEmail ? excludeEmail.trim().toLowerCase() : '';

      // Scan customer_profiles, rider_profiles, and legacy profiles for account creation rules
      const collectionsToCheck = ['customer_profiles', 'rider_profiles', 'profiles'];
      for (const collName of collectionsToCheck) {
        const snap = await getDocs(collection(db, collName));
        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          const docEmail = (data.email || docSnap.id || '').trim().toLowerCase();
          const docLicense = (data.licenseNumber || '').trim().toUpperCase();
          const docName = (data.name || '').trim().toLowerCase();

          // Skip current user's email if excluded
          if (cleanExclude && docEmail === cleanExclude) {
            continue;
          }

          // Combined Email AND Vehicle Registration Number Check:
          // Account creation is blocked when BOTH email AND vehicle registration number match an existing account record
          const isEmailMatch = cleanEmail && docEmail && cleanEmail === docEmail;
          const isLicenseMatch = cleanLicense && docLicense && cleanLicense === docLicense;

          if (isEmailMatch && isLicenseMatch) {
            return {
              hasDuplicate: true,
              message: `Account Conflict: An account with matching email "${cleanEmail}" and Vehicle Registration Number "${cleanLicense}" already exists. Please log in with your existing account.`
            };
          }

          // Name & Vehicle Registration Rule:
          // A person can create an account with the same name, BUT if they attempt to create an account
          // with a DIFFERENT / NEW vehicle registration number than the registered number for that name, block it!
          if (cleanName && docName && cleanName === docName && docLicense) {
            if (cleanLicense && cleanLicense !== docLicense) {
              return {
                hasDuplicate: true,
                message: `Account Creation Blocked: An account registered under the name "${nameToCheck.trim()}" already exists with Vehicle Registration Number (${docLicense}). You cannot register a new registration number during account creation. Please use your registered vehicle registration number or update it in profile settings after logging in.`
              };
            }
          }

          // Registration Number Conflict check across different accounts
          if (cleanLicense && docLicense && cleanLicense === docLicense && docEmail && cleanEmail && docEmail !== cleanEmail) {
            return {
              hasDuplicate: true,
              message: `Vehicle Registration Conflict: The Vehicle Registration Number "${cleanLicense}" is already registered under another account (${docEmail}).`
            };
          }
        }
      }
    } catch (err) {
      console.warn('Error checking duplicate profile in Firestore:', err);
    }

    return { hasDuplicate: false };
  };

  // Save profile to role-specific Cloud Firestore collection
  const saveProfileToFirestore = async (profile: UserProfile) => {
    const targetRole = profile.userRole || 'customer';
    const collectionName = getRoleCollection(targetRole);
    const normalizedEmail = profile.email.trim().toLowerCase();
    const docPath = `${collectionName}/${normalizedEmail}`;

    try {
      const userRef = doc(db, collectionName, normalizedEmail);
      const dataToSave: any = {
        name: profile.name,
        phone: profile.phone || '',
        email: normalizedEmail,
        address: profile.address || '',
        city: profile.city || '',
        state: profile.state || '',
        pincode: profile.pincode || '',
        userRole: targetRole,
        authMethod: profile.authMethod || (profile.password ? 'password' : 'google'),
        updatedAt: new Date().toISOString()
      };

      if (targetRole === 'rider') {
        dataToSave.vehicles = profile.vehicles || [];
        dataToSave.licenseNumber = profile.licenseNumber || '';
      }
      
      if (profile.password !== undefined && profile.password !== null && profile.password !== '') {
        dataToSave.password = profile.password;
      }

      await setDoc(userRef, dataToSave, { merge: true });

      // Save to legacy profiles doc for backward compatibility
      try {
        const legacyRef = doc(db, 'profiles', normalizedEmail);
        await setDoc(legacyRef, dataToSave, { merge: true });
      } catch (_) {}

      console.log(`Successfully saved profile to Cloud Firestore [${docPath}]`);
    } catch (err: any) {
      console.error(`Error saving profile to ${docPath}:`, err);
      showToast('Error saving profile to cloud: ' + err.message, 'error');
      handleFirestoreError(err, OperationType.WRITE, docPath);
    }
  };

  const handleSignUpPincodeChange = async (val: string) => {
    const cleanPin = val.replace(/\D/g, '').slice(0, 6);
    setPincode(cleanPin);

    if (cleanPin.length === 6) {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data[0]?.Status === 'Success' && Array.isArray(data[0]?.PostOffice) && data[0].PostOffice.length > 0) {
            const po = data[0].PostOffice[0];
            const foundCity = po.District || po.Block || po.Circle || po.Name || '';
            const rawState = po.State || '';

            if (foundCity) setCity(foundCity);
            if (rawState) {
              const matchedState = INDIAN_STATES.find(s => s.toLowerCase() === rawState.toLowerCase()) || 
                INDIAN_STATES.find(s => rawState.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(rawState.toLowerCase()));
              if (matchedState) setStateName(matchedState);
            }
            showToast(`Auto-detected ${foundCity} for PIN Code ${cleanPin}`, 'info');
          }
        }
      } catch (e) {
        console.warn('Pincode lookup error in sign up:', e);
      }
    }
  };

  // Handle manual form registration
  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);

    if (!name || !phone || !email || !password) {
      showToast('Please check the form for missing or invalid fields.', 'error');
      return;
    }

    if (phone.length !== 10) {
      showToast('Please enter a valid 10-digit mobile number!', 'error');
      return;
    }

    // Check Password Security Policy
    const passCheck = validatePassword(password);
    if (!passCheck.isValid) {
      showToast(`Password Error: ${passCheck.error}`, 'error');
      return;
    }

    const isRider = selectedPortal === 'rider';
    const targetRole: 'customer' | 'rider' = isRider ? 'rider' : 'customer';

    if (!isRider) {
      if (!address.trim()) {
        showToast('Please enter your primary delivery address (House/Flat/Street)!', 'error');
        return;
      }
      
      if (!city.trim()) {
        showToast('Please enter your City!', 'error');
        return;
      }
      if (!stateName.trim()) {
        showToast('Please select your State from the list!', 'error');
        return;
      }
      if (!pincode.trim() || pincode.trim().length !== 6 || !/^\d{6}$/.test(pincode.trim())) {
        showToast('Please enter a valid 6-digit PIN code!', 'error');
        return;
      }
    }

    // Check Rider specific requirements
    let finalVehicles = [...riderVehicles];
    if (isRider) {
      if (vehicleInput.trim() && finalVehicles.length === 0) {
        finalVehicles.push(vehicleInput.trim());
      }

      if (finalVehicles.length === 0) {
        showToast('Please add 1 registered vehicle (e.g. Activa 6G, Honda Splendor) to complete Rider sign up!', 'error');
        return;
      }

      if (finalVehicles.length > 1) {
        showToast('Maximum 1 registered vehicle allowed!', 'error');
        return;
      }

      if (!riderLicense.trim()) {
        showToast('Please enter your Vehicle Registration Number for verification compliance!', 'error');
        return;
      }

      const licVal = validateLicenseNumber(riderLicense);
      if (!licVal.isValid) {
        showToast(licVal.error!, 'error');
        return;
      }
    }

    const normalizedEmail = email.trim().toLowerCase();
    const formattedPhone = '+91' + phone.trim();

    // Check duplicate profile for targetRole
    const dupCheck = await checkDuplicateProfile(
      normalizedEmail,
      phone,
      name,
      isRider ? riderLicense : undefined,
      targetRole
    );

    if (dupCheck.hasDuplicate) {
      showToast(dupCheck.message!, 'error');
      return;
    }
    
    try {
      // 1. Register or verify Auth in Firebase
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
        if (userCredential.user) {
          try {
            await sendEmailVerification(userCredential.user);
          } catch (verErr: any) {
            console.error('Error sending email verification link:', verErr);
          }
        }
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
          // Email already exists in Firebase Auth from another role — authenticate password
          try {
            await signInWithEmailAndPassword(auth, normalizedEmail, password);
          } catch (signInErr: any) {
            showToast(`Account Conflict: Email "${normalizedEmail}" is registered in Firebase. Please enter your correct password to create your ${targetRole === 'rider' ? 'Delivery Partner' : 'Customer'} account.`, 'error');
            return;
          }
        } else {
          throw authErr;
        }
      }

      const fullAddressStr = !isRider 
        ? `${address.trim()}, ${city.trim()}, ${stateName.trim()} - ${pincode.trim()}`
        : 'Rider Partner Hub';

      const profile: UserProfile = {
        name: name.trim(),
        phone: formattedPhone,
        email: normalizedEmail,
        password: password,
        userRole: targetRole,
        authMethod: 'password',
        address: fullAddressStr,
        city: !isRider ? city.trim() : '',
        state: !isRider ? stateName.trim() : '',
        pincode: !isRider ? pincode.trim() : '',
        ...(isRider ? {
          vehicles: finalVehicles,
          licenseNumber: riderLicense.trim(),
        } : {})
      };

      // 2. Store full profile details in Cloud Firestore under role collection
      await saveProfileToFirestore(profile);

      // 2b. If customer, save primary address doc in addresses subcollection
      if (!isRider) {
        try {
          const primaryAddrRef = doc(db, 'customer_profiles', normalizedEmail, 'addresses', 'primary_home');
          const savedAddrObj = {
            id: 'primary_home',
            searchAddress: fullAddressStr,
            houseNo: address.trim(),
            city: city.trim(),
            state: stateName.trim(),
            pincode: pincode.trim(),
            label: 'Primary Address',
            receiverName: name.trim(),
            receiverPhone: formattedPhone,
            createdAt: new Date().toISOString()
          };
          await setDoc(primaryAddrRef, savedAddrObj, { merge: true });
        } catch (addrErr) {
          console.warn('Could not create primary address subcollection entry:', addrErr);
        }
      }

      // 3. Set local session
      if (targetRole === 'customer') {
        localStorage.setItem('dunzo_customer_onboarding_pending_' + normalizedEmail, 'true');
      }
      localStorage.setItem('dunzo_logistics_session', JSON.stringify(profile));
      setCurrentUser(profile);
      
      showToast(`Account created as ${targetRole === 'rider' ? 'Delivery Partner' : 'Customer'}! Welcome to the portal.`, 'success');
    } catch (err: any) {
      console.error('Firebase registration error:', err);
      showToast(err.message || 'Firebase Auth error occurred during registration.', 'error');
    }
  };

  // Handle direct sign-in from email + password
  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      showToast('Please enter both your email address and password!', 'error');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const targetRole: 'customer' | 'rider' = selectedPortal;

    // Check if profile exists for targetRole
    const targetProfile = await getProfileFromFirestore(normalizedEmail, targetRole);

    if (!targetProfile) {
      // Check if a profile exists in the OTHER role
      const otherRole = targetRole === 'customer' ? 'rider' : 'customer';
      const otherProfile = await getProfileFromFirestore(normalizedEmail, otherRole);

      if (otherProfile) {
        showToast(`No ${targetRole === 'rider' ? 'Delivery Partner' : 'Customer'} profile found for ${normalizedEmail}. (A ${targetRole === 'rider' ? 'Customer' : 'Delivery Partner'} account exists with this email. Click "Sign Up" above to create your ${targetRole === 'rider' ? 'Delivery Partner' : 'Customer'} account).`, 'error');
        return;
      }

      showToast(`No account found for ${normalizedEmail}. Please sign up first.`, 'error');
      return;
    }

    // Check if account was created using Google Sign-In
    if (targetProfile.authMethod === 'google') {
      showToast(`Login Method Conflict: ${normalizedEmail} was registered using Google Sign-In as ${targetRole === 'rider' ? 'Delivery Partner' : 'Customer'}. Please click the "Sign in with Google" button below to log in.`, 'error');
      return;
    }

    try {
      // Sign In using Firebase Auth
      await signInWithEmailAndPassword(auth, normalizedEmail, password);

      targetProfile.authMethod = 'password';

      // Log user in directly
      localStorage.setItem('dunzo_logistics_session', JSON.stringify(targetProfile));
      setCurrentUser(targetProfile);
      showToast(`Signed in successfully as ${targetRole === 'rider' ? 'Delivery Partner' : 'Customer'}!`, 'success');
    } catch (err: any) {
      console.error('Firebase Auth sign-in error:', err);
      showToast(err.message || 'Authentication rejected. Check your credentials.', 'error');
    }
  };

  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const fbUser = userCredential.user;
      
      if (!fbUser.email) {
        showToast('Google Sign-In failed: No email associated with this account.', 'error');
        return;
      }

      const normalizedEmail = fbUser.email.trim().toLowerCase();
      const targetRole: 'customer' | 'rider' = selectedPortal;

      // Fetch profile for targetRole
      const targetProfile = await getProfileFromFirestore(normalizedEmail, targetRole);

      let profile: UserProfile;

      if (targetProfile) {
        if (targetProfile.authMethod === 'password') {
          await signOut(auth); // Disconnect Google session immediately
          showToast(`Login Method Conflict: ${normalizedEmail} was registered using standard Email & Password as ${targetRole === 'rider' ? 'Delivery Partner' : 'Customer'}. Please log in using your Email & Password above.`, 'error');
          return;
        }
        profile = targetProfile;
        profile.authMethod = 'google';
      } else {
        // Pre-check duplicate profile for new Google user in targetRole
        const dupCheck = await checkDuplicateProfile(
          normalizedEmail,
          fbUser.phoneNumber || '',
          fbUser.displayName || '',
          undefined,
          targetRole,
          normalizedEmail
        );
        if (dupCheck.hasDuplicate) {
          await signOut(auth);
          showToast(dupCheck.message!, 'error');
          return;
        }

        // Create profile on the fly for targetRole if missing
        profile = {
          name: fbUser.displayName || normalizedEmail.split('@')[0],
          phone: fbUser.phoneNumber || '',
          email: normalizedEmail,
          address: targetRole === 'rider' ? 'Rider Hub' : '',
          password: '',
          userRole: targetRole,
          authMethod: 'google'
        };
        await saveProfileToFirestore(profile);
      }

      // Log user in directly
      localStorage.setItem('dunzo_logistics_session', JSON.stringify(profile));
      setCurrentUser(profile);
      showToast(`Authenticated successfully as ${profile.userRole === 'rider' ? 'Delivery Partner' : 'Customer'}!`, 'success');
    } catch (err: any) {
      console.error('Google Sign-In error:', err);
      showToast(err.message || 'Google Sign-In failed.', 'error');
    }
  };

  // Handle sign-out / session termination
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('dunzo_logistics_session');
      setCurrentUser(null);
      showToast('Session terminated. Credentials removed.', 'info');
    } catch (e) {
      console.error('Error signing out:', e);
      localStorage.removeItem('dunzo_logistics_session');
      setCurrentUser(null);
    }
  };

  // Check if Delivery Partner details are incomplete (e.g. logged in with Google or missing vehicles/DL)
  const isRiderIncomplete = currentUser && currentUser.userRole === 'rider' && (
    !currentUser.vehicles || 
    currentUser.vehicles.length === 0 || 
    !currentUser.licenseNumber || 
    !validateLicenseNumber(currentUser.licenseNumber).isValid ||
    !currentUser.phone
  );

  // Email verification check (Required for standard email/password registration, bypassed for Google Sign-In)
  const isGoogleUser = auth.currentUser?.providerData.some(p => p.providerId === 'google.com') ?? false;
  const needsEmailVerification = currentUser && auth.currentUser && !auth.currentUser.emailVerified && !isGoogleUser;

  if (needsEmailVerification) {
    return (
      <>
        {/* Dynamic Toast Notification Panel */}
        {notification && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:bottom-6 sm:right-6 sm:left-auto sm:translate-x-0 z-[9999] flex items-start justify-between gap-3 p-3.5 w-[calc(100%-32px)] sm:w-auto max-w-md sm:max-w-lg rounded-xl border-2 border-black bg-white shadow-[6px_6px_0px_rgba(0,0,0,1)] text-xs font-mono font-bold animate-fadeIn">
            <div className="flex items-start gap-2.5 min-w-0">
              {notification.type === 'success' && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-0.5"></span>}
              {notification.type === 'info' && <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 mt-0.5"></span>}
              {notification.type === 'error' && <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 mt-0.5"></span>}
              <span className="text-neutral-900 leading-snug font-sans font-bold">{notification.message}</span>
            </div>
            <button onClick={() => setNotification(null)} className="ml-2 hover:text-black text-neutral-400 shrink-0 cursor-pointer p-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <EmailVerificationView
          userEmail={currentUser.email}
          onCheckVerification={async () => {
            if (auth.currentUser) {
              await auth.currentUser.reload();
              if (auth.currentUser.emailVerified) {
                showToast('Email verified successfully! Welcome!', 'success');
                setCurrentUser({ ...currentUser });
              } else {
                showToast('Email not verified yet. Please click the link sent to your inbox.', 'error');
              }
            }
          }}
          onResendEmail={async () => {
            if (auth.currentUser) {
              try {
                await sendEmailVerification(auth.currentUser);
                showToast('Verification email re-sent! Check your inbox or spam folder.', 'success');
              } catch (err: any) {
                showToast(err.message || 'Failed to resend email.', 'error');
              }
            }
          }}
          onSignOut={handleSignOut}
        />
      </>
    );
  }

  // Render Rider mandatory onboarding if details missing
  if (currentUser && currentUser.userRole === 'rider') {
    if (isRiderIncomplete) {
      return (
        <>
          {/* Dynamic Toast Notification Panel */}
          {notification && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:bottom-6 sm:right-6 sm:left-auto sm:translate-x-0 z-[9999] flex items-start justify-between gap-3 p-3.5 w-[calc(100%-32px)] sm:w-auto max-w-md sm:max-w-lg rounded-xl border-2 border-black bg-white shadow-[6px_6px_0px_rgba(0,0,0,1)] text-xs font-mono font-bold animate-fadeIn">
              <div className="flex items-start gap-2.5 min-w-0">
                {notification.type === 'success' && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-0.5"></span>}
                {notification.type === 'info' && <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 mt-0.5"></span>}
                {notification.type === 'error' && <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 mt-0.5"></span>}
                <span className="text-neutral-900 leading-snug font-sans font-bold">{notification.message}</span>
              </div>
              <button onClick={() => setNotification(null)} className="ml-2 hover:text-black text-neutral-400 shrink-0 cursor-pointer p-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <RiderOnboardingView
            currentUser={currentUser}
            onSaveProfile={async (updatedProfile) => {
              const dupCheck = await checkDuplicateProfile(
                updatedProfile.email,
                updatedProfile.phone || '',
                updatedProfile.name,
                updatedProfile.licenseNumber,
                'rider',
                updatedProfile.email
              );
              if (dupCheck.hasDuplicate) {
                showToast(dupCheck.message!, 'error');
                throw new Error(dupCheck.message);
              }
              await saveProfileToFirestore(updatedProfile);
              localStorage.setItem('dunzo_logistics_session', JSON.stringify(updatedProfile));
              setCurrentUser(updatedProfile);
              showToast('Delivery Partner verification completed!', 'success');
            }}
            onSignOut={handleSignOut}
            showToast={showToast}
          />
        </>
      );
    }

    // Once details are complete, render the requested blank page for rider
    return (
      <div className="min-h-screen w-full bg-white flex flex-col justify-between p-4 sm:p-6 font-sans">
        {/* Minimal header with logout button so the user is not stuck */}
        <div className="w-full flex items-center justify-between border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-neutral-400 uppercase">
            <Bike className="w-4 h-4 text-[#00AF62]" />
            <span>Delivery Partner Portal</span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-black bg-white hover:bg-neutral-100 rounded-lg text-xs font-black uppercase text-black transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)] cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Completely Blank Page Content as explicitly instructed */}
        <div className="flex-1 flex items-center justify-center">
          {/* Blank page as requested */}
        </div>

        {/* Minimal silent footer */}
        <div className="text-center text-[10px] font-mono text-neutral-300">
          Partner ID: {currentUser.email}
        </div>
      </div>
    );
  }

  // Render full Customer Logistics Dashboard if authenticated as Customer
  if (currentUser) {
    return (
      <>
        {/* Dynamic Toast Notification Panel */}
        {notification && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:bottom-6 sm:right-6 sm:left-auto sm:translate-x-0 z-[9999] flex items-start justify-between gap-3 p-3.5 w-[calc(100%-32px)] sm:w-auto max-w-md sm:max-w-lg rounded-xl border-2 border-black bg-white shadow-[6px_6px_0px_rgba(0,0,0,1)] text-xs font-mono font-bold animate-fadeIn">
            <div className="flex items-start gap-2.5 min-w-0">
              {notification.type === 'success' && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-0.5"></span>}
              {notification.type === 'info' && <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 mt-0.5"></span>}
              {notification.type === 'error' && <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 mt-0.5"></span>}
              <span className="text-neutral-900 leading-snug font-sans font-bold">{notification.message}</span>
            </div>
            <button onClick={() => setNotification(null)} className="ml-2 hover:text-black text-neutral-400 shrink-0 cursor-pointer p-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <LogisticsDashboard
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          handleSignOut={handleSignOut}
          showToast={showToast}
        />
      </>
    );
  }

  // Render Landing Page if active
  if (showLanding) {
    return (
      <div className="min-h-screen w-full bg-black flex flex-col items-center justify-between p-4 sm:p-8 relative overflow-x-hidden overflow-y-auto font-sans animate-fadeIn">
        {/* Radial background glow */}
        <div className="absolute w-[800px] h-[800px] rounded-full bg-[#00E181]/12 blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2"></div>
        
        {/* Top Header Tag */}
        <div className="relative z-10 w-full max-w-6xl flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00E181] animate-ping"></span>
            <span className="text-[11px] font-black tracking-widest text-[#00E181] uppercase font-mono">
              PROJECT DUNZO · HYPERLOCAL NETWORK
            </span>
          </div>
          <span className="text-[10px] font-bold text-neutral-400 bg-neutral-900 px-3 py-1 rounded-full border border-neutral-800">
            v2.4 REALTIME DISPATCH
          </span>
        </div>

        {/* Main Content Area: Creative Grid Layout around Center Logo */}
        <div className="relative z-10 w-full max-w-6xl my-auto py-8 grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          
          {/* Left Column: Services 1 & 2 */}
          <div className="flex flex-col gap-5 order-2 lg:order-1">
            {/* Feature 1: Instant Groceries */}
            <div className="bg-neutral-950 border-2 border-neutral-800 hover:border-[#00E181]/60 p-5 rounded-2xl shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all duration-300 group">
              <div className="flex items-center gap-3 mb-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#00E181] text-black font-black flex items-center justify-center shrink-0 border border-black shadow-[2px_2px_0px_rgba(255,255,255,0.2)]">
                  <ShoppingCart className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-[9px] font-black text-[#00E181] tracking-wider uppercase bg-[#00E181]/10 px-2 py-0.5 rounded border border-[#00E181]/30">
                    15-20 MIN EXPRESS
                  </span>
                  <h3 className="text-sm font-black text-white uppercase tracking-tight mt-0.5">
                    Instant Grocery Delivery
                  </h3>
                </div>
              </div>
              <p className="text-xs text-neutral-400 font-medium leading-relaxed">
                Order fresh fruits, organic vegetables, daily dairy, snacks & household essentials from nearest dark stores.
              </p>
            </div>

            {/* Feature 2: Pick & Drop Courier */}
            <div className="bg-neutral-950 border-2 border-neutral-800 hover:border-[#00E181]/60 p-5 rounded-2xl shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all duration-300 group">
              <div className="flex items-center gap-3 mb-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-400 text-black font-black flex items-center justify-center shrink-0 border border-black shadow-[2px_2px_0px_rgba(255,255,255,0.2)]">
                  <ArrowLeftRight className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-[9px] font-black text-blue-400 tracking-wider uppercase bg-blue-500/10 px-2 py-0.5 rounded border border-blue-400/30">
                    POINT TO POINT
                  </span>
                  <h3 className="text-sm font-black text-white uppercase tracking-tight mt-0.5">
                    Courier Pick & Drop
                  </h3>
                </div>
              </div>
              <p className="text-xs text-neutral-400 font-medium leading-relaxed">
                Dispatch forgotten keys, official documents, lunchboxes, chargers, or gifts securely across the city with live telemetry.
              </p>
            </div>
          </div>

          {/* Center Column: The Interactive Central Logo */}
          <div className="flex flex-col items-center justify-center text-center order-1 lg:order-2 py-4">
            
            <button
              type="button"
              onClick={() => setShowLanding(false)}
              className="group relative focus:outline-none cursor-pointer transform hover:scale-105 active:scale-95 transition-all duration-300"
              title="Click logo to enter portal"
            >
              {/* Outer pulsing glow ring */}
              <div className="absolute -inset-2 bg-[#00E181]/30 rounded-3xl blur-xl group-hover:bg-[#00E181]/50 transition duration-500 animate-pulse"></div>
              
              {/* Logo Card */}
              <div className="relative bg-black p-8 sm:p-14 md:p-16 rounded-3xl border-3 sm:border-4 border-[#00E181] shadow-[0_0_90px_rgba(0,225,129,0.4)] flex flex-col items-center justify-center gap-6">
                <ProjectDunzoLogo className="h-28 sm:h-40 md:h-52 max-w-full w-auto" />

                {/* Click-to-Enter Pill */}
                <div className="bg-[#00E181] group-hover:bg-[#00ff94] text-black font-black text-xs px-6 py-3 rounded-2xl border-2 border-black shadow-[3px_3px_0px_rgba(255,255,255,0.9)] flex items-center gap-2 uppercase tracking-wider transition-all">
                  <span>CLICK LOGO TO ENTER PORTAL</span>
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                </div>
              </div>
            </button>

            <span className="text-[11px] font-mono text-neutral-400 font-bold tracking-wider uppercase mt-4">
              ← CLICK THE LOGO TO PROCEED TO LOGIN →
            </span>
          </div>

          {/* Right Column: Services 3 & 4 */}
          <div className="flex flex-col gap-5 order-3">
            {/* Feature 3: Small Boutique Purchases */}
            <div className="bg-neutral-950 border-2 border-neutral-800 hover:border-[#00E181]/60 p-5 rounded-2xl shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all duration-300 group">
              <div className="flex items-center gap-3 mb-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-400 text-black font-black flex items-center justify-center shrink-0 border border-black shadow-[2px_2px_0px_rgba(255,255,255,0.2)]">
                  <Shirt className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-[9px] font-black text-purple-400 tracking-wider uppercase bg-purple-500/10 px-2 py-0.5 rounded border border-purple-400/30">
                    LOCAL MERCHANTS
                  </span>
                  <h3 className="text-sm font-black text-white uppercase tracking-tight mt-0.5">
                    Small Boutique Garments
                  </h3>
                </div>
              </div>
              <p className="text-xs text-neutral-400 font-medium leading-relaxed">
                Shop curated linen items, custom apparel, gifts & limited edition craft pieces from independent local boutiques.
              </p>
            </div>

            {/* Feature 4: Elder Care & Personal Concierge */}
            <div className="bg-neutral-950 border-2 border-neutral-800 hover:border-[#00E181]/60 p-5 rounded-2xl shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all duration-300 group">
              <div className="flex items-center gap-3 mb-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-black font-black flex items-center justify-center shrink-0 border border-black shadow-[2px_2px_0px_rgba(255,255,255,0.2)]">
                  <HeartHandshake className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-[9px] font-black text-amber-400 tracking-wider uppercase bg-amber-500/10 px-2 py-0.5 rounded border border-amber-400/30">
                    CARE ASSISTANCE
                  </span>
                  <h3 className="text-sm font-black text-white uppercase tracking-tight mt-0.5">
                    Elder Companion & Chores
                  </h3>
                </div>
              </div>
              <p className="text-xs text-neutral-400 font-medium leading-relaxed">
                Book verified caretakers to accompany elderly family members to doctors, pick up prescription medicines, or manage errands.
              </p>
            </div>
          </div>

        </div>

        {/* Bottom Feature Bar */}
        <div className="relative z-10 w-full max-w-6xl border-t border-neutral-800 pt-4 flex flex-wrap items-center justify-between gap-3 text-neutral-400 text-xs font-mono">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#00E181]" />
            <span>Hyperlocal Logistics Engine</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#00E181]" />
            <span>Firebase Security Rules & Multi-Role Portals</span>
          </div>
          <span className="text-[10px] text-neutral-500 font-bold uppercase">
            Designed for Instant Citywide Fulfillment
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-neutral-100 flex items-center justify-center p-3 sm:p-6 md:p-8 font-sans">
      
      {/* Invisible Recaptcha Anchor */}
      <div id="recaptcha-container" className="hidden"></div>

      {/* Dynamic Toast Notification Panel */}
      {notification && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:bottom-6 sm:right-6 sm:left-auto sm:translate-x-0 z-[9999] flex items-start justify-between gap-3 p-3.5 w-[calc(100%-32px)] sm:w-auto max-w-md sm:max-w-lg rounded-xl border-2 border-black bg-white shadow-[6px_6px_0px_rgba(0,0,0,1)] text-xs font-mono font-bold animate-fadeIn">
          <div className="flex items-start gap-2.5 min-w-0">
            {notification.type === 'success' && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-0.5"></span>}
            {notification.type === 'info' && <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 mt-0.5"></span>}
            {notification.type === 'error' && <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 mt-0.5"></span>}
            <span className="text-neutral-900 leading-snug font-sans font-bold">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="ml-2 hover:text-black text-neutral-400 shrink-0 cursor-pointer p-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Container Card Frame */}
      <div className="w-full max-w-xl bg-white border-3 sm:border-4 border-black rounded-2xl sm:rounded-3xl shadow-[8px_8px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col transition-all my-auto">
        
        {/* Top Dunzo Accent Bar (Green for Customer, Yellow/Orange for Rider) */}
        <div className={`h-2.5 w-full border-b-2 border-black transition-colors ${selectedPortal === 'rider' ? 'bg-amber-400' : 'bg-[#00E181]'}`}></div>

        {/* Inner Card Wrapper with responsive padding */}
        <div className="p-5 sm:p-8 flex flex-col gap-5">
          
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-dashed border-neutral-200 pb-4">
            {/* Dunzo Brand Logo Row */}
            <div className="flex items-center gap-3">
              <div className="bg-black px-4 py-2.5 rounded-xl border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_rgba(0,0,0,1)] select-none">
                <ProjectDunzoLogo className="h-8 sm:h-10 w-auto" />
              </div>
              
              <div className="h-7 w-[2px] bg-neutral-300 hidden sm:block"></div>
              
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-neutral-400 tracking-wider uppercase leading-none mb-1">
                  {selectedPortal === 'rider' ? 'DELIVERY PARTNER PORTAL' : 'CUSTOMER LOGISTICS PORTAL'}
                </span>
                <span className="text-xs sm:text-sm font-black text-neutral-900 tracking-tight flex items-center gap-1.5 leading-none">
                  Project Dunzo <span className="text-[#00AF62] font-black">· {selectedPortal === 'rider' ? 'Rider Network' : 'Enterprise'}</span>
                </span>
              </div>
            </div>

            {/* Portal Badge */}
            <div className="self-start sm:self-auto">
              <div className={`border-2 border-black px-3 py-1 rounded-full text-[10px] font-black text-black flex items-center gap-1.5 shadow-[2px_2px_0px_rgba(0,0,0,1)] ${selectedPortal === 'rider' ? 'bg-amber-300' : 'bg-[#00E181]/20'}`}>
                {selectedPortal === 'rider' ? <Bike className="w-3.5 h-3.5 stroke-[2.5]" /> : <ShoppingBag className="w-3.5 h-3.5 stroke-[2.5]" />}
                <span>{selectedPortal === 'rider' ? 'RIDER AUTH' : 'CUSTOMER AUTH'}</span>
              </div>
            </div>
          </div>

          {/* 1. PORTAL ROLE SELECTION SWITCHER (Separate Logins for Customer vs Rider) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-neutral-400 tracking-wider uppercase">SELECT YOUR ACCESS PORTAL</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-100 border-2 border-black rounded-xl shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              <button
                type="button"
                onClick={() => {
                  setSelectedPortal('customer');
                  setIsSignUp(true);
                }}
                className={`py-2.5 px-3 rounded-lg text-xs font-black tracking-wide uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  selectedPortal === 'customer'
                    ? 'bg-[#00E181] text-black border-2 border-black shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)]'
                    : 'text-neutral-600 hover:text-black font-bold'
                }`}
              >
                <ShoppingBag className="w-4 h-4 stroke-[2.5]" />
                <span>Customer Login</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedPortal('rider');
                  setIsSignUp(true);
                }}
                className={`py-2.5 px-3 rounded-lg text-xs font-black tracking-wide uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  selectedPortal === 'rider'
                    ? 'bg-amber-400 text-black border-2 border-black shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)]'
                    : 'text-neutral-600 hover:text-black font-bold'
                }`}
              >
                <Bike className="w-4 h-4 stroke-[2.5]" />
                <span>Delivery Partner</span>
              </button>
            </div>
          </div>

          {/* 2. TAB SELECTOR FOR SIGN IN VS CREATE ACCOUNT */}
          <div className="flex border-2 border-black rounded-xl p-1 bg-neutral-100 self-center w-full shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            <button
              type="button"
              onClick={() => setIsSignUp(true)}
              className={`flex-1 py-2 rounded-lg text-xs font-black tracking-wide uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isSignUp
                  ? selectedPortal === 'rider' ? 'bg-amber-400 text-black border-2 border-black shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)]' : 'bg-[#00E181] text-black border-2 border-black shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)]'
                  : 'text-neutral-500 hover:text-black font-bold'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{selectedPortal === 'rider' ? 'Rider Sign Up' : 'Create Account'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSignUp(false)}
              className={`flex-1 py-2 rounded-lg text-xs font-black tracking-wide uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
                !isSignUp
                  ? selectedPortal === 'rider' ? 'bg-amber-400 text-black border-2 border-black shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)]' : 'bg-[#00E181] text-black border-2 border-black shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)]'
                  : 'text-neutral-500 hover:text-black font-bold'
              }`}
            >
              <LogIn className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Sign In</span>
            </button>
          </div>

          {/* Title and Description */}
          <div className="flex flex-col gap-1 text-left">
            <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight text-neutral-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {selectedPortal === 'rider'
                  ? (isSignUp ? 'Delivery Partner Registration' : 'Delivery Partner Sign In')
                  : (isSignUp ? 'Create Customer Account' : 'Welcome Back Customer')
                }
              </span>
            </h1>
            <p className="text-xs text-neutral-500 font-medium">
              {selectedPortal === 'rider'
                ? (isSignUp 
                    ? 'Register your vehicle and vehicle registration number to join Project Dunzo fleet.' 
                    : 'Sign in to access your delivery partner profile.'
                  )
                : (isSignUp 
                    ? 'Register your profile details to access Project Dunzo delivery channels.' 
                    : 'Enter your credentials to access your active logistics dashboard.'
                  )
              }
            </p>
          </div>

          {/* Form Layout */}
          <form onSubmit={isSignUp ? handleRegister : handleSignIn} className="flex flex-col gap-4">
            
            {/* SIGN UP EXCLUSIVE FIELDS */}
            {isSignUp && (
              <>
                {/* FULL LEGAL NAME */}
                <div>
                  <label className="text-[10px] font-black text-neutral-400 tracking-wider uppercase mb-1 block">FULL NAME *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Kartik Gowda"
                      required={isSignUp}
                      className={`w-full pl-10 pr-3.5 py-2.5 text-xs font-bold border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00E181] bg-white transition-all text-neutral-900 ${
                        formSubmitted && !name.trim() ? 'border-red-500 bg-red-50/20' : 'border-black'
                      }`}
                    />
                  </div>
                  {formSubmitted && !name.trim() && (
                    <p className="text-[11px] font-bold text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Full legal name is required.</span>
                    </p>
                  )}
                </div>

                {/* MOBILE NUMBER */}
                <div>
                  <label className="text-[10px] font-black text-neutral-400 tracking-wider uppercase mb-1 block">MOBILE NUMBER *</label>
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
                      title="10-digit mobile number"
                      value={phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setPhone(val);
                      }}
                      placeholder="9876543210"
                      required={isSignUp}
                      className={`w-full pl-20 pr-3.5 py-2.5 text-xs font-bold border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00E181] bg-white transition-all text-neutral-900 ${
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
              </>
            )}

            {/* SHARED FIELDS (EMAIL & PASSWORD) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-[10px] font-black text-neutral-400 tracking-wider uppercase mb-1 block">EMAIL ADDRESS *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className={`w-full pl-10 pr-3.5 py-2.5 text-xs font-bold border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00E181] bg-white transition-all text-neutral-900 ${
                      formSubmitted && !email.trim() ? 'border-red-500 bg-red-50/20' : 'border-black'
                    }`}
                  />
                </div>
                {formSubmitted && !email.trim() && (
                  <p className="text-[11px] font-bold text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Email address is required.</span>
                  </p>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black text-neutral-400 tracking-wider uppercase mb-1 block">PASSWORD *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-neutral-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className={`w-full pl-10 pr-3.5 py-2.5 text-xs font-bold border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00E181] bg-white transition-all text-neutral-900 ${
                      isSignUp && password.length > 0 && !validatePassword(password).isValid ? 'border-red-500 bg-red-50/20' : 'border-black'
                    }`}
                  />
                </div>

                {/* Password Inline Error Message */}
                {isSignUp && password.length > 0 && !validatePassword(password).isValid && (
                  <div className="mt-1.5 p-2 bg-red-50 border-2 border-red-500 rounded-xl text-red-600 text-[11px] font-bold flex items-start gap-1.5 shadow-[2px_2px_0px_rgba(239,68,68,1)]">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                    <span>Password Error: {validatePassword(password).error}</span>
                  </div>
                )}

                {/* Password Policy Checklist (Visible during Sign Up) */}
                {isSignUp && (
                  <div className="grid grid-cols-2 gap-1 mt-2 p-2 bg-neutral-50 border border-neutral-200 rounded-xl text-[10px] font-mono font-bold">
                    <div className={`flex items-center gap-1 ${password.length >= 8 ? 'text-emerald-600 font-extrabold' : 'text-neutral-400'}`}>
                      <span>{password.length >= 8 ? '✓' : '○'}</span>
                      <span>8+ Chars</span>
                    </div>
                    <div className={`flex items-center gap-1 ${/[A-Z]/.test(password) ? 'text-emerald-600 font-extrabold' : 'text-neutral-400'}`}>
                      <span>{/[A-Z]/.test(password) ? '✓' : '○'}</span>
                      <span>1 Uppercase</span>
                    </div>
                    <div className={`flex items-center gap-1 ${/[0-9]/.test(password) ? 'text-emerald-600 font-extrabold' : 'text-neutral-400'}`}>
                      <span>{/[0-9]/.test(password) ? '✓' : '○'}</span>
                      <span>1 Number</span>
                    </div>
                    <div className={`flex items-center gap-1 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? 'text-emerald-600 font-extrabold' : 'text-neutral-400'}`}>
                      <span>{/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? '✓' : '○'}</span>
                      <span>1 Special (@, _, #)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CUSTOMER EXCLUSIVE FIELDS: DETAILED PRIMARY DELIVERY ADDRESS */}
            {isSignUp && selectedPortal === 'customer' && (
              <div className="flex flex-col gap-3 p-3.5 bg-neutral-50 border-2 border-black rounded-2xl">
                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">
                  PRIMARY DELIVERY LOCATION DETAILS *
                </span>

                {/* House No / Flat / Street */}
                <div>
                  <label className="text-[10px] font-black text-neutral-400 tracking-wider uppercase mb-1 block">STREET / HOUSE / FLAT ADDRESS *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-neutral-400">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. Apt 302, Green Glen Layout, Bellandur"
                      required={isSignUp && selectedPortal === 'customer'}
                      rows={2}
                      className={`w-full pl-10 pr-3.5 py-2 text-xs font-bold border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00E181] bg-white transition-all text-neutral-900 resize-none leading-relaxed ${
                        formSubmitted && !address.trim() ? 'border-red-500 bg-red-50/20' : 'border-black'
                      }`}
                    />
                  </div>
                  {formSubmitted && !address.trim() && (
                    <p className="text-[11px] font-bold text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>House/Street address is required.</span>
                    </p>
                  )}
                </div>

                {/* City + PIN Code Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* City */}
                  <div>
                    <label className="text-[10px] font-black text-neutral-400 tracking-wider uppercase mb-1 block">CITY *</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Bengaluru"
                      required={isSignUp && selectedPortal === 'customer'}
                      className={`w-full px-3 py-2 text-xs font-bold border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00E181] bg-white transition-all text-neutral-900 ${
                        formSubmitted && !city.trim() ? 'border-red-500 bg-red-50/20' : 'border-black'
                      }`}
                    />
                  </div>

                  {/* PIN Code */}
                  <div>
                    <label className="text-[10px] font-black text-neutral-400 tracking-wider uppercase mb-1 block">PIN CODE (6 DIGITS) *</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => handleSignUpPincodeChange(e.target.value)}
                      placeholder="560103"
                      required={isSignUp && selectedPortal === 'customer'}
                      className={`w-full px-3 py-2 text-xs font-mono font-bold border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00E181] bg-white transition-all text-neutral-900 ${
                        formSubmitted && (pincode.length !== 6 || !/^\d{6}$/.test(pincode)) ? 'border-red-500 bg-red-50/20' : 'border-black'
                      }`}
                    />
                  </div>
                </div>

                {/* State Dropdown Select */}
                <div>
                  <label className="text-[10px] font-black text-neutral-400 tracking-wider uppercase mb-1 block">SELECT STATE *</label>
                  <select
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    required={isSignUp && selectedPortal === 'customer'}
                    className={`w-full px-3 py-2 text-xs font-bold border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00E181] bg-white transition-all text-neutral-900 ${
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
                      <span>State selection is mandatory.</span>
                    </p>
                  )}
                </div>

              </div>
            )}

            {/* RIDER EXCLUSIVE FIELDS: VEHICLE TYPE/BRAND & VEHICLE REGISTRATION NUMBER VERIFICATION */}
            {isSignUp && selectedPortal === 'rider' && (
              <div className="flex flex-col gap-3.5 border-2 border-black rounded-2xl p-4 bg-amber-50/50 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                
                {/* Notice Banner explicitly mentioning max 1 vehicle */}
                <div className="flex items-start gap-2 bg-amber-100 border border-amber-300 p-2.5 rounded-xl text-xs text-amber-900 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-black uppercase text-[10px] tracking-wider text-amber-800">Vehicle Limit Notice</span>
                    <span className="leading-tight">Delivery partners can register <strong>only 1 vehicle</strong> (e.g., Activa, Honda, TVS, Ather).</span>
                  </div>
                </div>

                {/* 1. VEHICLE BRAND / MODEL INPUT & ADD BUTTON */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black text-neutral-700 tracking-wider uppercase flex items-center gap-1">
                      <Bike className="w-3.5 h-3.5 text-amber-600" />
                      <span>REGISTER VEHICLE * (MAX 1 ALLOWED)</span>
                    </label>
                    <span className="text-[10px] font-black text-amber-800 font-mono">
                      {riderVehicles.length}/1 Added
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
                      placeholder={riderVehicles.length >= 1 ? "Maximum 1 vehicle registered" : "e.g. Activa 6G, Honda Splendor, Ather 450"}
                      className="flex-1 px-3.5 py-2.5 text-xs font-bold border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white transition-all text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={handleAddVehicle}
                      disabled={riderVehicles.length >= 1}
                      className="px-3.5 py-2.5 bg-amber-400 hover:bg-amber-500 disabled:bg-neutral-200 text-black border-2 border-black rounded-xl font-black text-xs uppercase flex items-center gap-1 transition-all shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)] cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span className="hidden sm:inline">Add</span>
                    </button>
                  </div>

                  {/* Vehicle missing alert */}
                  {riderVehicles.length === 0 && (
                    <div className="mt-1.5 p-2 bg-amber-100 border-2 border-amber-400 rounded-xl text-amber-950 text-[11px] font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-700" />
                      <span>Type a vehicle name above & click Add (e.g. Activa 6G, Honda Splendor).</span>
                    </div>
                  )}

                  {/* Registered Vehicles Chips */}
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

                {/* 2. VEHICLE REGISTRATION NUMBER VERIFICATION */}
                <div>
                  <label className="text-[10px] font-black text-neutral-700 tracking-wider uppercase mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>VEHICLE REGISTRATION NUMBER * (FOR VERIFICATION)</span>
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
                      required={isSignUp && selectedPortal === 'rider'}
                      className={`w-full pl-10 pr-3.5 py-2.5 text-xs font-mono font-bold border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white transition-all text-neutral-900 uppercase ${
                        riderLicense.trim().length > 0 && !validateLicenseNumber(riderLicense).isValid ? 'border-red-500 bg-red-50/20' : 'border-black'
                      }`}
                    />
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
            )}

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              className={`border-2 border-black py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] active:translate-y-[1px] flex items-center justify-center gap-2 mt-2 cursor-pointer ${
                selectedPortal === 'rider'
                  ? 'bg-amber-400 hover:bg-amber-500 text-black'
                  : 'bg-[#00E181] hover:bg-emerald-400 text-black'
              }`}
            >
              <span>
                {selectedPortal === 'rider'
                  ? (isSignUp ? 'Register as Delivery Partner' : 'Sign In to Partner Portal')
                  : (isSignUp ? 'Initialize Customer Account' : 'Sign In to Dashboard')
                }
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* DIVIDER */}
            <div className="relative flex items-center justify-center my-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-dashed border-neutral-200"></div>
              </div>
              <span className="relative bg-white px-3 text-[10px] font-black text-neutral-400 uppercase tracking-wider">
                OR CONTINUE WITH
              </span>
            </div>

            {/* GOOGLE SIGN IN BUTTON */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full bg-white hover:bg-neutral-50 text-neutral-900 border-2 border-black py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] active:translate-y-[1px] flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
              </svg>
              <span>Google Account</span>
            </button>

          </form>

        </div>

      </div>

    </div>
  );
}

