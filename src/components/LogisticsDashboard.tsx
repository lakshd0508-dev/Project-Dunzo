import React, { useState, useEffect, FormEvent } from 'react';
import { ProjectDunzoLogo } from './ProjectDunzoLogo';
import {
  MapPin,
  User,
  LogOut,
  ChevronDown,
  Plus,
  Search,
  Compass,
  Loader2,
  Check,
  Home,
  Briefcase,
  Navigation,
  Phone,
  Mail,
  UserCircle,
  X,
  Save,
  Sparkles,
  Edit2,
  Trash2,
  Package,
  Clock,
  Send,
  Activity,
  ShoppingCart,
  Truck,
  Shirt,
  HeartHandshake,
  ArrowLeftRight,
  ArrowLeft,
  ShieldCheck,
  FileCheck
} from 'lucide-react';

// Vehicle Registration Number Auto-Formatter: XX-00-AB-0000 (e.g. KA-05-AB-1234)
const formatVehicleRegNumber = (raw: string): string => {
  const clean = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10);
  let formatted = '';
  if (clean.length > 0) formatted += clean.slice(0, 2);
  if (clean.length > 2) formatted += '-' + clean.slice(2, 4);
  if (clean.length > 4) formatted += '-' + clean.slice(4, 6);
  if (clean.length > 6) formatted += '-' + clean.slice(6, 10);
  return formatted;
};

// Vehicle Registration Number Validator
const validateVehicleRegNumber = (lic: string): { isValid: boolean; error?: string } => {
  const clean = lic.trim().toUpperCase();
  if (!clean) return { isValid: true };

  const parts = clean.split('-');
  if (parts.length !== 4) {
    return { 
      isValid: false, 
      error: 'Invalid Vehicle Registration Number format! Required format: XX-00-AB-0000 (e.g. KA-05-AB-1234).' 
    };
  }

  const [p1, p2, p3, p4] = parts;
  if (!/^[A-Z]{2}$/.test(p1) || !/^\d{2}$/.test(p2) || !/^[A-Z0-9]{1,2}$/.test(p3) || !/^\d{4}$/.test(p4)) {
    return { isValid: false, error: 'Vehicle Registration error: Must follow format XX-00-AB-0000 (e.g. KA-05-AB-1234).' };
  }

  return { isValid: true };
};
import { UserProfile, SavedAddress, ErrandDispatch, DispatchZone, LogEntry, INDIAN_STATES } from '../types';
import { db } from '../firebase';
import { doc, setDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';

interface LogisticsDashboardProps {
  currentUser: UserProfile;
  setCurrentUser: (user: UserProfile | null) => void;
  handleSignOut: () => void;
  showToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

// Helper to strip +91 prefix for 10-digit inputs
const getClean10DigitPhone = (phone: string) => {
  let p = phone || '';
  if (p.startsWith('+91')) {
    p = p.substring(3);
  } else if (p.startsWith('91') && p.length > 10) {
    p = p.substring(2);
  }
  return p.replace(/\D/g, '').slice(0, 10);
};

// Static simulation configurations (Bengaluru context mapping matching the canvas roads coordinates)
const DEFAULT_ZONES: DispatchZone[] = [
  { id: 'center', name: 'CENTRAL HUB', coords: { x: 500, y: 500 }, loadLevel: 'OPTIMAL', agentsAvailable: 12 },
  { id: 'indiranagar', name: 'INDIRANAGAR HUB', coords: { x: 200, y: 150 }, loadLevel: 'LOW', agentsAvailable: 8 },
  { id: 'whitefield', name: 'WHITEFIELD HUB', coords: { x: 850, y: 300 }, loadLevel: 'HIGH', agentsAvailable: 4 },
  { id: 'koramangala', name: 'KORAMANGALA HUB', coords: { x: 250, y: 800 }, loadLevel: 'OPTIMAL', agentsAvailable: 15 },
  { id: 'hsr', name: 'HSR LAYOUT HUB', coords: { x: 500, y: 850 }, loadLevel: 'OPTIMAL', agentsAvailable: 10 },
];

const AGENTS_LIST = [
  { name: 'Rahul Prasad', phone: '+91 98765 11122' },
  { name: 'Sunil Dutt', phone: '+91 87654 22233' },
  { name: 'Amanpreet Singh', phone: '+91 76543 33344' },
  { name: 'Vikram Sen', phone: '+91 91234 44455' },
  { name: 'Ramesh Kumar', phone: '+91 82345 55566' },
  { name: 'Suresh Nair', phone: '+91 73456 66677' },
];

const INITIAL_DISPATCHES: ErrandDispatch[] = [
  {
    id: 'ER-802',
    category: 'Grocery',
    pickupAddress: 'Indiranagar Central Mart (Dunzo Node)',
    dropAddress: 'Apt 405, Green Glen Layout, Bellandur',
    priority: 'STANDARD',
    status: 'transit',
    progress: 35,
    createdAt: new Date(Date.now() - 300000).toISOString(),
    agentName: 'Suresh Nair',
    agentPhone: '+91 73456 66677',
    estimatedTime: 12,
    elapsedTime: 4,
    pickupCoords: { x: 200, y: 150 },
    dropCoords: { x: 500, y: 500 },
    currentCoords: { x: 305, y: 272.5 }
  },
  {
    id: 'ER-511',
    category: 'Medical',
    pickupAddress: 'Apollo Pharmacy, Whitefield (Dunzo Node)',
    dropAddress: 'Tower B, Palm Heights, ITPL Road',
    priority: 'CRITICAL',
    status: 'collected',
    progress: 60,
    createdAt: new Date(Date.now() - 420000).toISOString(),
    agentName: 'Amanpreet Singh',
    agentPhone: '+91 76543 33344',
    estimatedTime: 8,
    elapsedTime: 5,
    pickupCoords: { x: 850, y: 300 },
    dropCoords: { x: 500, y: 850 },
    currentCoords: { x: 640, y: 630 }
  }
];

export default function LogisticsDashboard({
  currentUser,
  setCurrentUser,
  handleSignOut,
  showToast
}: LogisticsDashboardProps) {
  // Active selected address states - Primary Address as default delivery location
  const [activeAddressText, setActiveAddressText] = useState<string>(
    currentUser.address && currentUser.address.trim() ? currentUser.address.trim() : 'Primary Address Missing'
  );
  const [activeAddressLabel, setActiveAddressLabel] = useState<string>('Primary Address');
  const [activeAddressDetails, setActiveAddressDetails] = useState<SavedAddress | null>(null);

  // Mandatory Onboarding & Primary Address Completion modal states
  const [mandatoryModalOpen, setMandatoryModalOpen] = useState(false);
  const [mandatoryName, setMandatoryName] = useState(currentUser.name || '');
  const [mandatoryPhone, setMandatoryPhone] = useState(getClean10DigitPhone(currentUser.phone));
  const [mandatoryAddress, setMandatoryAddress] = useState(currentUser.address || '');
  const [mandatoryCity, setMandatoryCity] = useState(currentUser.city || '');
  const [mandatoryState, setMandatoryState] = useState(currentUser.state || '');
  const [mandatoryPincode, setMandatoryPincode] = useState(currentUser.pincode || '');
  const [isSavingMandatory, setIsSavingMandatory] = useState(false);

  // Simulation states
  const [dispatches, setDispatches] = useState<ErrandDispatch[]>(INITIAL_DISPATCHES);
  const [zones, setZones] = useState<DispatchZone[]>(DEFAULT_ZONES);
  const [selectedHub, setSelectedHub] = useState<string>('center');
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'log_init',
      timestamp: new Date().toLocaleTimeString(),
      message: 'Logistics console initialized. Connection established with secure Node.',
      type: 'system'
    }
  ]);

  // Form states for launching a new dispatch
  const [launchCategory, setLaunchCategory] = useState<'Grocery' | 'Medical' | 'Documents' | 'Tech Gear' | 'Food Crate'>('Grocery');
  const [launchPriority, setLaunchPriority] = useState<'STANDARD' | 'EXPRESS' | 'CRITICAL'>('STANDARD');
  const [launchDestinationHub, setLaunchDestinationHub] = useState<string>('center');
  const [dispatchDirection, setDispatchDirection] = useState<'to_hub' | 'from_hub'>('from_hub');

  // Navigation screen state
  const [activeTab, setActiveTab] = useState<'services' | 'dispatches'>('services');

  // Service Selection & Sub-States
  const [selectedService, setSelectedService] = useState<'grocery' | 'courier' | 'boutique' | 'concierge' | null>(null);

  // 1. Grocery configurations
  const [selectedGroceryStore, setSelectedGroceryStore] = useState('Indiranagar Central Mart');
  const [selectedGroceryItems, setSelectedGroceryItems] = useState<string[]>(['Fresh Organic Bananas (1 Dozen)']);
  
  // 2. Courier configurations
  const [courierItemDesc, setCourierItemDesc] = useState('');
  const [courierWeightClass, setCourierWeightClass] = useState<'LIGHT' | 'MEDIUM' | 'HEAVY'>('LIGHT');
  const [courierPickupInput, setCourierPickupInput] = useState('');
  const [courierDropInput, setCourierDropInput] = useState('');
  
  // 3. Boutique configurations
  const [selectedBoutiqueBrand, setSelectedBoutiqueBrand] = useState('Bengaluru Handloom Society');
  const [selectedBoutiqueItems, setSelectedBoutiqueItems] = useState<string[]>(['Handloomed Indigo Shirt']);
  const [boutiqueItemSize, setBoutiqueItemSize] = useState<'S' | 'M' | 'L' | 'XL'>('M');

  // 4. Personal Concierge / Caretaker configurations
  const [conciergeSpecialty, setConciergeSpecialty] = useState('Senior Care Medical Escort');
  const [conciergeHours, setConciergeHours] = useState<number>(2);
  const [conciergeNurseCertified, setConciergeNurseCertified] = useState(false);
  const [conciergeInstructions, setConciergeInstructions] = useState('');

  // Lists of saved addresses
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  // Geolocation / IP loading states
  const [isLocating, setIsLocating] = useState(false);

  // Modal display toggles
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Address form fields
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSearchItem, setSelectedSearchItem] = useState<any | null>(null);

  const [houseNo, setHouseNo] = useState('');
  const [buildingBlock, setBuildingBlock] = useState('');
  const [landmarkArea, setLandmarkArea] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [addrPincode, setAddrPincode] = useState('');
  const [addressLabel, setAddressLabel] = useState('Home'); // Home, Work, Other
  const [customLabel, setCustomLabel] = useState('');
  const [receiverName, setReceiverName] = useState(currentUser.name);
  const [receiverPhone, setReceiverPhone] = useState(getClean10DigitPhone(currentUser.phone));
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  // Mandatory Sign Up Address Search & GPS detection states
  const [mandatorySearchQuery, setMandatorySearchQuery] = useState('');
  const [mandatorySearchResults, setMandatorySearchResults] = useState<any[]>([]);
  const [isSearchingMandatory, setIsSearchingMandatory] = useState(false);
  const [isLocatingMandatory, setIsLocatingMandatory] = useState(false);

  // Live OSM Stores state
  const [osmStores, setOsmStores] = useState<any[]>([]);
  const [isFetchingOsmStores, setIsFetchingOsmStores] = useState(false);

  // Profile fields & address search states
  const [profileName, setProfileName] = useState(currentUser.name);
  const [profilePhone, setProfilePhone] = useState(getClean10DigitPhone(currentUser.phone));
  const [profileAddress, setProfileAddress] = useState(currentUser.address);
  const [profileCity, setProfileCity] = useState(currentUser.city || '');
  const [profileState, setProfileState] = useState(currentUser.state || '');
  const [profilePincode, setProfilePincode] = useState(currentUser.pincode || '');
  const [profileLicense, setProfileLicense] = useState(currentUser.licenseNumber ? formatVehicleRegNumber(currentUser.licenseNumber) : '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Profile Address Search & GPS Auto-Detect States
  const [profileSearchQuery, setProfileSearchQuery] = useState('');
  const [profileSearchResults, setProfileSearchResults] = useState<any[]>([]);
  const [isSearchingProfile, setIsSearchingProfile] = useState(false);
  const [isLocatingProfile, setIsLocatingProfile] = useState(false);
  const [isPincodeLoading, setIsPincodeLoading] = useState(false);

  // Run primary address verification and fetch addresses on mount
  useEffect(() => {
    fetchSavedAddresses();

    const isPendingOnboarding = localStorage.getItem('dunzo_customer_onboarding_pending_' + currentUser.email) === 'true';
    const isAddressMissing = !currentUser.address || currentUser.address.trim().length === 0;

    if (currentUser.address && currentUser.address.trim().length > 0) {
      setActiveAddressText(currentUser.address.trim());
      setActiveAddressLabel('Primary Address');
    } else {
      setActiveAddressText('Primary Address Missing');
      setActiveAddressLabel('Primary Address');
    }

    if (isPendingOnboarding || isAddressMissing) {
      setMandatoryModalOpen(true);
    }
  }, [currentUser.address, currentUser.email]);

  useEffect(() => {
    setMandatoryName(currentUser.name || '');
    setMandatoryPhone(getClean10DigitPhone(currentUser.phone));
    setMandatoryAddress(currentUser.address || '');
    setProfileName(currentUser.name || '');
    setProfilePhone(getClean10DigitPhone(currentUser.phone));
    setProfileAddress(currentUser.address || '');
  }, [currentUser]);

  // Simulation Timer to animate active dispatches
  useEffect(() => {
    const timer = setInterval(() => {
      const logsToAdd: LogEntry[] = [];
      const toastsToShow: string[] = [];

      setDispatches(prev => {
        return prev.map(dispatch => {
          if (dispatch.status === 'delivered') return dispatch;

          const nextProgress = Math.min(dispatch.progress + 2, 100);
          let nextStatus = dispatch.status;
          
          if (nextProgress >= 100) {
            nextStatus = 'delivered';
            logsToAdd.push({
              id: `log_${Date.now()}_${dispatch.id}`,
              timestamp: new Date().toLocaleTimeString(),
              message: `Errand ${dispatch.id} delivered successfully to destination by ${dispatch.agentName}!`,
              type: 'success'
            });
            toastsToShow.push(`Errand ${dispatch.id} has been delivered!`);
          } else if (nextProgress >= 85) {
            nextStatus = 'transit';
          } else if (nextProgress >= 35 && dispatch.status === 'assigned') {
            nextStatus = 'collected';
            logsToAdd.push({
              id: `log_${Date.now()}_${dispatch.id}`,
              timestamp: new Date().toLocaleTimeString(),
              message: `Agent ${dispatch.agentName} collected items for ${dispatch.id}. En route.`,
              type: 'route'
            });
          }

          // Calculate current coords by interpolating between pickup and drop
          const p = nextProgress / 100;
          const currentCoords = {
            x: dispatch.pickupCoords.x + (dispatch.dropCoords.x - dispatch.pickupCoords.x) * p,
            y: dispatch.pickupCoords.y + (dispatch.dropCoords.y - dispatch.pickupCoords.y) * p,
          };

          const elapsed = Math.min(dispatch.estimatedTime, Math.floor((nextProgress / 100) * dispatch.estimatedTime));

          return {
            ...dispatch,
            progress: nextProgress,
            status: nextStatus as any,
            currentCoords,
            elapsedTime: elapsed
          };
        });
      });

      if (logsToAdd.length > 0) {
        setLogs(l => [...logsToAdd, ...l]);
      }
      if (toastsToShow.length > 0) {
        toastsToShow.forEach(msg => showToast(msg, 'success'));
      }
    }, 2500);

    return () => clearInterval(timer);
  }, [showToast]);

  // Helper to generate coordinates relative to selected hubs
  const getRandomOffsetCoords = (baseCoords: { x: number; y: number }) => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 180 + Math.random() * 140;
    const x = Math.max(120, Math.min(880, Math.floor(baseCoords.x + Math.cos(angle) * distance)));
    const y = Math.max(120, Math.min(880, Math.floor(baseCoords.y + Math.sin(angle) * distance)));
    return { x, y };
  };

  // Generic launcher for all core services
  const handleLaunchServiceDispatch = (
    serviceType: 'grocery' | 'courier' | 'boutique' | 'concierge',
    details: {
      category: 'Grocery' | 'Courier' | 'Boutique' | 'Concierge';
      pickupAddress: string;
      dropAddress: string;
      priority: 'STANDARD' | 'EXPRESS' | 'CRITICAL';
      detailsText: string;
    }
  ) => {
    const randomAgent = AGENTS_LIST[Math.floor(Math.random() * AGENTS_LIST.length)];
    const chosenHub = zones.find(z => z.id === selectedHub) || zones[0];

    let pickupCoords = { ...chosenHub.coords };
    let dropCoords = getRandomOffsetCoords(chosenHub.coords);

    // Coordinate adjustments to look realistic on map
    if (serviceType === 'courier') {
      pickupCoords = getRandomOffsetCoords(chosenHub.coords);
      dropCoords = getRandomOffsetCoords(pickupCoords);
    } else if (serviceType === 'boutique') {
      pickupCoords = { x: 850, y: 300 }; // Whitefield boutique hub coords
      dropCoords = { x: 500, y: 500 }; // Central
    } else if (serviceType === 'concierge') {
      pickupCoords = { x: 500, y: 500 }; // Central
      dropCoords = getRandomOffsetCoords(chosenHub.coords);
    }

    const dispatchId = `ER-${Math.floor(100 + Math.random() * 900)}`;
    const estTime = details.priority === 'CRITICAL' ? 6 : (details.priority === 'EXPRESS' ? 10 : 15);

    const newDispatch: ErrandDispatch = {
      id: dispatchId,
      category: details.category,
      pickupAddress: details.pickupAddress,
      dropAddress: details.dropAddress,
      priority: details.priority,
      status: 'assigned',
      progress: 0,
      createdAt: new Date().toISOString(),
      agentName: randomAgent.name,
      agentPhone: randomAgent.phone,
      estimatedTime: estTime,
      elapsedTime: 0,
      pickupCoords,
      dropCoords,
      currentCoords: pickupCoords
    };

    setDispatches(prev => [newDispatch, ...prev]);

    setLogs(prev => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        message: `Launched ${details.category} Errand [${dispatchId}]: ${details.detailsText}. Agent ${randomAgent.name} assigned.`,
        type: 'agent'
      },
      ...prev
    ]);

    // Dynamic load management feedback
    setZones(prev => prev.map(z => {
      if (z.id === chosenHub.id) {
        const nextCount = Math.max(0, z.agentsAvailable - 1);
        return {
          ...z,
          agentsAvailable: nextCount,
          loadLevel: nextCount < 3 ? 'HIGH' : (nextCount > 8 ? 'OPTIMAL' : 'LOW')
        };
      }
      return z;
    }));

    showToast(`Successfully launched ${details.category} Errand ${dispatchId}!`, 'success');
    setSelectedService(null); // Return to choice view
    setActiveTab('dispatches'); // Switch to active dispatches tab to view live telemetry
  };

  // Errand termination handler
  const handleCancelDispatch = (id: string) => {
    setDispatches(prev => prev.filter(d => d.id !== id));
    setLogs(prev => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        message: `Errand ${id} was terminated and removed from active tracking list.`,
        type: 'system'
      },
      ...prev
    ]);
    showToast(`Errand ${id} terminated.`, 'info');
  };

  // Fetch saved addresses from subcollection `profiles/{email}/addresses`
  const fetchSavedAddresses = async () => {
    setLoadingAddresses(true);
    try {
      const addressesRef = collection(db, 'profiles', currentUser.email, 'addresses');
      const snapshot = await getDocs(addressesRef);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SavedAddress[];
      
      // Sort by creation date (newest first)
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setSavedAddresses(list);
    } catch (err: any) {
      console.error('Error fetching saved addresses:', err);
      showToast('Could not load saved addresses: ' + err.message, 'error');
    } finally {
      setLoadingAddresses(false);
    }
  };

  // Helper to fallback to Chennai/IP location
  const runIPFallback = async () => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const data = await res.json();
        if (data && data.city) {
          const detectedCity = data.city;
          const detectedRegion = data.region || 'Tamil Nadu';
          const ipAddr = `${detectedCity}, ${detectedRegion}, India`;
          setActiveAddressText(ipAddr);
          setActiveAddressLabel('Approximate Location');
          showToast(`Location set to: ${ipAddr}`, 'success');
          return;
        }
      }
    } catch (err) {
      console.warn('IP lookup failed:', err);
    }

    // Absolute fallback: Chennai, India (since the user is in Chennai!)
    setActiveAddressText('Chennai, Tamil Nadu, India');
    setActiveAddressLabel('Default Node');
    showToast('Set location to Chennai, India', 'info');
  };

// Indian Localities Catalog for Instant Offline/Online Geocoding & Address Searches
const INDIAN_LOCALITIES_CATALOG = [
  // Chennai Localities
  { name: "Porur, Chennai", area: "Porur", city: "Chennai", state: "Tamil Nadu", pincode: "600116", street: "Mount-Poonamallee Trunk Road, Porur", lat: 13.0382, lng: 80.1565 },
  { name: "Poonamallee, Chennai", area: "Poonamallee", city: "Chennai", state: "Tamil Nadu", pincode: "600056", street: "Poonamallee High Road, Poonamallee", lat: 13.0499, lng: 80.0911 },
  { name: "Anna Nagar, Chennai", area: "Anna Nagar", city: "Chennai", state: "Tamil Nadu", pincode: "600040", street: "2nd Avenue, Anna Nagar", lat: 13.0878, lng: 80.2170 },
  { name: "T. Nagar, Chennai", area: "T. Nagar", city: "Chennai", state: "Tamil Nadu", pincode: "600017", street: "G N Chetty Road, T. Nagar", lat: 13.0418, lng: 80.2341 },
  { name: "Velachery, Chennai", area: "Velachery", city: "Chennai", state: "Tamil Nadu", pincode: "600042", street: "Velachery Main Road, Velachery", lat: 12.9815, lng: 80.2180 },
  { name: "Adyar, Chennai", area: "Adyar", city: "Chennai", state: "Tamil Nadu", pincode: "600020", street: "Lattice Bridge Road, Adyar", lat: 13.0012, lng: 80.2565 },
  { name: "Guindy, Chennai", area: "Guindy", city: "Chennai", state: "Tamil Nadu", pincode: "600032", street: "GST Road, Guindy", lat: 13.0067, lng: 80.2020 },
  { name: "Tambaram, Chennai", area: "Tambaram", city: "Chennai", state: "Tamil Nadu", pincode: "600045", street: "GST Road, Tambaram", lat: 12.9249, lng: 80.1000 },
  { name: "Ambattur, Chennai", area: "Ambattur", city: "Chennai", state: "Tamil Nadu", pincode: "600053", street: "CTH Road, Ambattur", lat: 13.1143, lng: 80.1548 },
  { name: "Nungambakkam, Chennai", area: "Nungambakkam", city: "Chennai", state: "Tamil Nadu", pincode: "600034", street: "Nungambakkam High Road", lat: 13.0569, lng: 80.2425 },
  { name: "Mylapore, Chennai", area: "Mylapore", city: "Chennai", state: "Tamil Nadu", pincode: "600004", street: "Luz Church Road, Mylapore", lat: 13.0368, lng: 80.2676 },
  { name: "Sholinganallur (OMR), Chennai", area: "Sholinganallur", city: "Chennai", state: "Tamil Nadu", pincode: "600119", street: "Old Mahabalipuram Road (OMR)", lat: 12.9010, lng: 80.2279 },
  { name: "Vadapalani, Chennai", area: "Vadapalani", city: "Chennai", state: "Tamil Nadu", pincode: "600026", street: "Arcot Road, Vadapalani", lat: 13.0500, lng: 80.2121 },
  { name: "Ramapuram, Chennai", area: "Ramapuram", city: "Chennai", state: "Tamil Nadu", pincode: "600089", street: "Mount-Poonamallee Road, Ramapuram", lat: 13.0310, lng: 80.1780 },
  { name: "Ashok Nagar, Chennai", area: "Ashok Nagar", city: "Chennai", state: "Tamil Nadu", pincode: "600083", street: "1st Block, Ashok Nagar", lat: 13.0350, lng: 80.2120 },
  { name: "Iyyappanthangal, Chennai", area: "Iyyappanthangal", city: "Chennai", state: "Tamil Nadu", pincode: "600056", street: "Mount-Poonamallee Road, Iyyappanthangal", lat: 13.0430, lng: 80.1360 },
  { name: "Mangadu, Chennai", area: "Mangadu", city: "Chennai", state: "Tamil Nadu", pincode: "600122", street: "Mangadu Main Road", lat: 13.0400, lng: 80.1180 },
  { name: "Karambakkam, Porur, Chennai", area: "Karambakkam", city: "Chennai", state: "Tamil Nadu", pincode: "600116", street: "Karambakkam Main Road, Porur", lat: 13.0420, lng: 80.1510 },
  { name: "Chromepet, Chennai", area: "Chromepet", city: "Chennai", state: "Tamil Nadu", pincode: "600044", street: "GST Road, Chromepet", lat: 12.9516, lng: 80.1462 },
  { name: "Perambur, Chennai", area: "Perambur", city: "Chennai", state: "Tamil Nadu", pincode: "600011", street: "Paper Mills Road, Perambur", lat: 13.1118, lng: 80.2355 },
  // Bengaluru, Mumbai, Delhi, Hyderabad
  { name: "Indiranagar, Bengaluru", area: "Indiranagar", city: "Bengaluru", state: "Karnataka", pincode: "560038", street: "100 Feet Road, Indiranagar", lat: 12.9784, lng: 77.6408 },
  { name: "Koramangala, Bengaluru", area: "Koramangala", city: "Bengaluru", state: "Karnataka", pincode: "560095", street: "80 Feet Road, Koramangala", lat: 12.9352, lng: 77.6245 },
  { name: "Whitefield, Bengaluru", area: "Whitefield", city: "Bengaluru", state: "Karnataka", pincode: "560066", street: "ITPL Main Road, Whitefield", lat: 12.9698, lng: 77.7500 },
  { name: "HSR Layout, Bengaluru", area: "HSR Layout", city: "Bengaluru", state: "Karnataka", pincode: "560102", street: "27th Main Road, Sector 1, HSR Layout", lat: 12.9121, lng: 77.6446 },
  { name: "Connaught Place, New Delhi", area: "Connaught Place", city: "New Delhi", state: "Delhi", pincode: "110001", street: "Inner Circle, Connaught Place", lat: 28.6315, lng: 77.2167 },
  { name: "Andheri West, Mumbai", area: "Andheri West", city: "Mumbai", state: "Maharashtra", pincode: "400053", street: "Link Road, Andheri West", lat: 19.1363, lng: 72.8277 },
  { name: "Bandra West, Mumbai", area: "Bandra West", city: "Mumbai", state: "Maharashtra", pincode: "400050", street: "Linking Road, Bandra West", lat: 19.0596, lng: 72.8295 },
  { name: "Gachibowli, Hyderabad", area: "Gachibowli", city: "Hyderabad", state: "Telangana", pincode: "500032", street: "Gachibowli Main Road", lat: 17.4401, lng: 78.3489 }
];

// Robust Multi-Service Reverse Geocoder - GUARANTEES clean address string without raw coordinates
const fetchAddressFromCoords = async (lat: number, lng: number) => {
  // 1. BigDataCloud Client Reverse Geocode API
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );
    if (res.ok) {
      const data = await res.json();
      const locality = data.locality || data.city || data.localityInfo?.administrative?.[2]?.name || '';
      const city = data.city || data.localityInfo?.administrative?.[1]?.name || 'Chennai';
      const state = data.principalSubdivision || 'Tamil Nadu';
      const postcode = data.postcode || '';
      const street = data.localityInfo?.informative?.[0]?.name || locality || 'Main Road';

      if (locality || city) {
        const parts = [street, locality, city, state, postcode].filter(Boolean);
        const uniqueParts = Array.from(new Set(parts));
        return {
          displayName: uniqueParts.join(', '),
          street: `${street}${locality && locality !== street ? ', ' + locality : ''}`,
          city: city,
          state: state,
          pincode: postcode || '600116',
          area: locality || city
        };
      }
    }
  } catch (e) {
    console.warn('BigDataCloud reverse geocode failed:', e);
  }

  // 2. Nominatim OpenStreetMap Reverse Geocode API
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
    );
    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const suburb = addr.suburb || addr.neighbourhood || addr.residential || addr.subdistrict || addr.locality || addr.town || addr.village || addr.city_district || '';
        const road = addr.road || addr.pedestrian || addr.building || 'Main Road';
        const city = addr.city || addr.town || addr.county || addr.municipality || 'Chennai';
        const state = addr.state || 'Tamil Nadu';
        const postcode = addr.postcode || '600116';

        const parts = [road, suburb, city, state, postcode].filter(Boolean);
        const uniqueParts = Array.from(new Set(parts));
        return {
          displayName: uniqueParts.join(', '),
          street: `${road}${suburb ? ', ' + suburb : ''}`,
          city: city,
          state: state,
          pincode: postcode,
          area: suburb || city
        };
      }
    }
  } catch (e) {
    console.warn('Nominatim reverse geocode failed:', e);
  }

  // 3. Nearest Local Catalog Point Calculation (Euclidean Distance)
  let nearest = INDIAN_LOCALITIES_CATALOG[0];
  let minDist = Infinity;
  for (const item of INDIAN_LOCALITIES_CATALOG) {
    const dist = Math.hypot(item.lat - lat, item.lng - lng);
    if (dist < minDist) {
      minDist = dist;
      nearest = item;
    }
  }

  return {
    displayName: `${nearest.street}, ${nearest.city}, ${nearest.state} - ${nearest.pincode}`,
    street: nearest.street,
    city: nearest.city,
    state: nearest.state,
    pincode: nearest.pincode,
    area: nearest.area
  };
};

// Robust Multi-Service Address Search Helper
const executeAddressSearch = async (query: string) => {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const results: any[] = [];

  // 1. Search Local Catalog first for instant response
  const catalogMatches = INDIAN_LOCALITIES_CATALOG.filter(
    item =>
      item.name.toLowerCase().includes(q) ||
      item.area.toLowerCase().includes(q) ||
      item.city.toLowerCase().includes(q) ||
      item.street.toLowerCase().includes(q) ||
      item.pincode.includes(q)
  );

  for (const match of catalogMatches) {
    results.push({
      display_name: `${match.street}, ${match.area}, ${match.city}, ${match.state} - ${match.pincode}`,
      address: {
        road: match.street,
        suburb: match.area,
        city: match.city,
        state: match.state,
        postcode: match.pincode
      },
      parsed: match
    });
  }

  // 2. Query Photon Komoot API
  try {
    const photonRes = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query + ' India')}&limit=6`
    );
    if (photonRes.ok) {
      const pData = await photonRes.json();
      if (pData && pData.features) {
        for (const feat of pData.features) {
          const props = feat.properties || {};
          const name = props.name || props.street || query;
          const city = props.city || props.town || props.state || 'Chennai';
          const suburb = props.district || props.suburb || props.locality || '';
          const state = props.state || 'Tamil Nadu';
          const postcode = props.postcode || '';

          const parts = [name, suburb, city, state, postcode].filter(Boolean);
          const fullText = Array.from(new Set(parts)).join(', ');

          results.push({
            display_name: fullText,
            address: {
              road: name,
              suburb: suburb,
              city: city,
              state: state,
              postcode: postcode
            }
          });
        }
      }
    }
  } catch (e) {
    console.warn('Photon search failed:', e);
  }

  // 3. Query Nominatim API
  try {
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&limit=6&addressdetails=1&countrycodes=in`
    );
    if (nomRes.ok) {
      const nData = await nomRes.json();
      if (Array.isArray(nData)) {
        for (const item of nData) {
          results.push(item);
        }
      }
    }
  } catch (e) {
    console.warn('Nominatim search failed:', e);
  }

  // Deduplicate by display_name
  const seen = new Set<string>();
  const uniqueResults: any[] = [];
  for (const r of results) {
    const key = (r.display_name || '').toLowerCase().trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      uniqueResults.push(r);
    }
  }

  return uniqueResults;
};

  // Detect location using high accuracy browser GPS without returning raw coordinates
  const detectLocation = () => {
    setIsLocating(true);
    setActiveAddressText('Detecting high-precision device location...');

    if (!navigator.geolocation) {
      runIPFallback().then(() => setIsLocating(false));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const addrInfo = await fetchAddressFromCoords(latitude, longitude);

        setActiveAddressText(addrInfo.displayName);
        setActiveAddressLabel('Current Location');
        setActiveAddressDetails(null);

        // Auto-fill address form fields if modal is open
        setSearchQuery(addrInfo.displayName);
        setHouseNo(addrInfo.street);
        setLandmarkArea(addrInfo.area);
        setAddrCity(addrInfo.city);
        setAddrState(addrInfo.state);
        setAddrPincode(addrInfo.pincode);

        showToast(`Location set to: ${addrInfo.area || addrInfo.city}`, 'success');
        setIsLocating(false);
      },
      async (error) => {
        console.warn('GPS position acquisition error, using smart fallback:', error.message);
        const fallback = await fetchAddressFromCoords(13.0382, 80.1565);
        setActiveAddressText(fallback.displayName);
        setActiveAddressLabel('Current Location');

        setSearchQuery(fallback.displayName);
        setHouseNo(fallback.street);
        setLandmarkArea(fallback.area);
        setAddrCity(fallback.city);
        setAddrState(fallback.state);
        setAddrPincode(fallback.pincode);

        showToast(`Location set to: ${fallback.area}`, 'info');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Helper to auto-detect City and State from 6-digit Indian PIN Code using official Postal API & OSM fallback
  const fetchCityStateFromPincode = async (pincode: string): Promise<{ city: string; state: string } | null> => {
    const cleanPin = pincode.replace(/\D/g, '').trim();
    if (cleanPin.length !== 6) return null;

    // 1. Query India Post API
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data[0]?.Status === 'Success' && Array.isArray(data[0]?.PostOffice) && data[0].PostOffice.length > 0) {
          const po = data[0].PostOffice[0];
          const rawDistrict = po.District || po.Block || po.Circle || po.Name || '';
          const rawState = po.State || '';

          let matchedState = INDIAN_STATES.find(s => s.toLowerCase() === rawState.toLowerCase());
          if (!matchedState && rawState) {
            matchedState = INDIAN_STATES.find(s => rawState.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(rawState.toLowerCase()));
          }

          return {
            city: rawDistrict,
            state: matchedState || rawState || ''
          };
        }
      }
    } catch (e) {
      console.warn('India Post API pincode lookup error:', e);
    }

    // 2. Query Nominatim postcode fallback
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&postalcode=${cleanPin}&country=India&addressdetails=1`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const addr = data[0].address || {};
          const city = addr.city || addr.town || addr.county || addr.state_district || addr.suburb || '';
          const rawState = addr.state || '';

          let matchedState = INDIAN_STATES.find(s => s.toLowerCase() === rawState.toLowerCase());
          if (!matchedState && rawState) {
            matchedState = INDIAN_STATES.find(s => rawState.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(rawState.toLowerCase()));
          }

          return {
            city,
            state: matchedState || rawState || ''
          };
        }
      }
    } catch (e) {
      console.warn('Nominatim postcode lookup error:', e);
    }

    return null;
  };

  // Live address search for mandatory sign up address modal
  const handleMandatoryAddressSearch = async (query: string) => {
    setMandatorySearchQuery(query);
    if (query.trim().length < 2) {
      setMandatorySearchResults([]);
      return;
    }
    setIsSearchingMandatory(true);
    try {
      const res = await executeAddressSearch(query);
      setMandatorySearchResults(res);
    } catch (err) {
      console.error('Mandatory address search error:', err);
    } finally {
      setIsSearchingMandatory(false);
    }
  };

  // Auto-populate all mandatory address fields when user selects a search result
  const handleSelectMandatorySearchResult = async (item: any) => {
    setMandatorySearchQuery(item.display_name || '');
    setMandatorySearchResults([]);

    const displayName = item.display_name || '';
    const addrObj = item.address || {};
    const parsed = item.parsed || {};

    const streetText = parsed.street || addrObj.road || addrObj.suburb || displayName.split(',')[0];
    let cityText = parsed.city || addrObj.city || addrObj.town || addrObj.suburb || 'Chennai';
    let stateText = parsed.state || addrObj.state || 'Tamil Nadu';
    const pincodeText = parsed.pincode || addrObj.postcode || '600116';

    setMandatoryAddress(streetText);
    setMandatoryCity(cityText);
    setMandatoryState(stateText);
    setMandatoryPincode(pincodeText);

    if (pincodeText && pincodeText.trim().length === 6) {
      const pinInfo = await fetchCityStateFromPincode(pincodeText);
      if (pinInfo) {
        if (pinInfo.city) setMandatoryCity(pinInfo.city);
        if (pinInfo.state) setMandatoryState(pinInfo.state);
        showToast(`Auto-detected ${pinInfo.city}, ${pinInfo.state} from PIN Code ${pincodeText}!`, 'success');
      } else {
        showToast('Primary address details auto-filled from search!', 'info');
      }
    } else {
      showToast('Primary address details auto-filled from search!', 'info');
    }
  };

  // Mandatory PIN Code Change with automatic city/state detection
  const handleMandatoryPincodeChange = async (value: string) => {
    const cleanPin = value.replace(/\D/g, '').slice(0, 6);
    setMandatoryPincode(cleanPin);

    if (cleanPin.length === 6) {
      const pinDetails = await fetchCityStateFromPincode(cleanPin);
      if (pinDetails) {
        if (pinDetails.city) setMandatoryCity(pinDetails.city);
        if (pinDetails.state) setMandatoryState(pinDetails.state);
        showToast(`PIN Code ${cleanPin}: Auto-filled ${pinDetails.city}, ${pinDetails.state}`, 'success');
      }
    }
  };

  // Live address search for Profile Modal
  const handleProfileAddressSearch = async (query: string) => {
    setProfileSearchQuery(query);
    if (query.trim().length < 2) {
      setProfileSearchResults([]);
      return;
    }
    setIsSearchingProfile(true);
    try {
      const res = await executeAddressSearch(query);
      setProfileSearchResults(res);
    } catch (err) {
      console.error('Profile address search error:', err);
    } finally {
      setIsSearchingProfile(false);
    }
  };

  // Select search result in Profile Modal
  const handleSelectProfileSearchResult = async (item: any) => {
    setProfileSearchQuery(item.display_name || '');
    setProfileSearchResults([]);

    const displayName = item.display_name || '';
    const addrObj = item.address || {};
    const parsed = item.parsed || {};

    const streetText = parsed.street || addrObj.road || addrObj.suburb || displayName.split(',')[0];
    let cityText = parsed.city || addrObj.city || addrObj.town || addrObj.suburb || '';
    let stateText = parsed.state || addrObj.state || '';
    const pincodeText = parsed.pincode || addrObj.postcode || '';

    setProfileAddress(streetText);
    if (cityText) setProfileCity(cityText);
    if (stateText) setProfileState(stateText);
    if (pincodeText) setProfilePincode(pincodeText);

    if (pincodeText && pincodeText.trim().length === 6) {
      setIsPincodeLoading(true);
      const pinInfo = await fetchCityStateFromPincode(pincodeText);
      if (pinInfo) {
        if (pinInfo.city) setProfileCity(pinInfo.city);
        if (pinInfo.state) setProfileState(pinInfo.state);
        showToast(`Address selected! Auto-filled ${pinInfo.city}, ${pinInfo.state} from PIN Code ${pincodeText}`, 'success');
      } else {
        showToast('Profile address auto-filled from search!', 'info');
      }
      setIsPincodeLoading(false);
    } else {
      showToast('Profile address auto-filled from search!', 'info');
    }
  };

  // Detect GPS location for Profile Modal
  const handleDetectProfileGPSLocation = () => {
    setIsLocatingProfile(true);
    showToast('Detecting precise device GPS location...', 'info');

    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.', 'error');
      setIsLocatingProfile(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const addrInfo = await fetchAddressFromCoords(latitude, longitude);

        setProfileSearchQuery(addrInfo.displayName);
        setProfileAddress(addrInfo.street || addrInfo.area || addrInfo.displayName);
        if (addrInfo.city) setProfileCity(addrInfo.city);
        if (addrInfo.state) setProfileState(addrInfo.state);
        if (addrInfo.pincode) setProfilePincode(addrInfo.pincode);

        if (addrInfo.pincode && addrInfo.pincode.length === 6) {
          setIsPincodeLoading(true);
          const pinInfo = await fetchCityStateFromPincode(addrInfo.pincode);
          if (pinInfo) {
            if (pinInfo.city) setProfileCity(pinInfo.city);
            if (pinInfo.state) setProfileState(pinInfo.state);
          }
          setIsPincodeLoading(false);
        }

        showToast(`GPS location auto-filled in profile: ${addrInfo.area || addrInfo.city}!`, 'success');
        setIsLocatingProfile(false);
      },
      async (err) => {
        console.warn('Profile GPS detection error:', err);
        const fallback = await fetchAddressFromCoords(13.0382, 80.1565);
        setProfileSearchQuery(fallback.displayName);
        setProfileAddress(fallback.street);
        setProfileCity(fallback.city);
        setProfileState(fallback.state);
        setProfilePincode(fallback.pincode);

        showToast(`Location set to: ${fallback.area}`, 'info');
        setIsLocatingProfile(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Handle PIN code manual typing in Profile Modal
  const handleProfilePincodeChange = async (value: string) => {
    const cleanPin = value.replace(/\D/g, '').slice(0, 6);
    setProfilePincode(cleanPin);

    if (cleanPin.length === 6) {
      setIsPincodeLoading(true);
      const pinDetails = await fetchCityStateFromPincode(cleanPin);
      if (pinDetails) {
        if (pinDetails.city) setProfileCity(pinDetails.city);
        if (pinDetails.state) setProfileState(pinDetails.state);
        showToast(`PIN Code ${cleanPin} verified! Auto-detected ${pinDetails.city}, ${pinDetails.state}`, 'success');
      }
      setIsPincodeLoading(false);
    }
  };

  // Detect GPS location for mandatory address during Sign Up
  const handleDetectMandatoryGPSLocation = () => {
    setIsLocatingMandatory(true);
    showToast('Detecting precise device GPS location...', 'info');

    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.', 'error');
      setIsLocatingMandatory(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const addrInfo = await fetchAddressFromCoords(latitude, longitude);

        setMandatorySearchQuery(addrInfo.displayName);
        setMandatoryAddress(addrInfo.street);
        setMandatoryCity(addrInfo.city);
        setMandatoryState(addrInfo.state);
        setMandatoryPincode(addrInfo.pincode);

        showToast(`GPS location auto-filled: ${addrInfo.area || addrInfo.city}!`, 'success');
        setIsLocatingMandatory(false);
      },
      async (err) => {
        console.warn('Mandatory GPS detection error:', err);
        const fallback = await fetchAddressFromCoords(13.0382, 80.1565);
        setMandatorySearchQuery(fallback.displayName);
        setMandatoryAddress(fallback.street);
        setMandatoryCity(fallback.city);
        setMandatoryState(fallback.state);
        setMandatoryPincode(fallback.pincode);

        showToast(`Location set to: ${fallback.area}`, 'info');
        setIsLocatingMandatory(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Helper to extract clean locality (e.g., Porur, Bellandur, Anna Nagar) from user's active address
  const extractLocality = (addressStr: string): string => {
    if (!addressStr || addressStr.trim().length === 0 || addressStr.includes('Missing')) {
      return 'Your Neighborhood';
    }
    const parts = addressStr.split(',').map(s => s.trim()).filter(Boolean);
    const filtered = parts.filter(p => 
      !/india|tamil nadu|karnataka|maharashtra|delhi|kerala|andhra/i.test(p) && 
      !/^\d{6}$/.test(p)
    );

    if (filtered.length > 0) {
      if (/^\d+|flat|apt|house|no\./i.test(filtered[0]) && filtered.length > 1) {
        return filtered[1];
      }
      return filtered[0];
    }
    return parts[0] || 'Your Neighborhood';
  };

  const userLocality = extractLocality(activeAddressText || currentUser.address || '');

  // Compute hyper-local store nodes tailored to user's active location (Zero Cost)
  const getDynamicGroceryStores = () => {
    const loc = userLocality;
    const baseStores = [
      { id: 'zepto', name: `Zepto Superfast - ${loc} Central`, desc: '3-10 min instant node', distance: '0.6 km away', tag: 'Fastest' },
      { id: 'blinkit', name: `Blinkit Dark Store - ${loc} Main Rd`, desc: '8-12 min instant delivery', distance: '1.1 km away', tag: 'Popular' },
      { id: 'instamart', name: `Swiggy Instamart Pod - ${loc} Hub`, desc: 'Daily essentials & fresh produce', distance: '1.5 km away', tag: 'Top Rated' },
      { id: 'bigbasket', name: `BigBasket Now - ${loc} Express`, desc: 'Organic groceries & bulk deals', distance: '2.1 km away', tag: 'Best Value' },
      { id: 'dmart', name: `DMart Ready - ${loc} Junction`, desc: 'Wholesale prices & pantry staples', distance: '2.8 km away', tag: 'Budget Pick' }
    ];

    if (osmStores.length > 0) {
      const convertedOsm = osmStores.map((store, i) => ({
        id: `osm_${i}`,
        name: `${store.name} - ${loc}`,
        desc: 'Local verified supermarket (OSM Node)',
        distance: `${(0.8 + i * 0.4).toFixed(1)} km away`,
        tag: 'Verified Store'
      }));
      return [...baseStores, ...convertedOsm];
    }

    return baseStores;
  };

  // Zero-cost fetcher for real nearby OSM supermarkets
  const fetchNearbyOsmSupermarkets = async () => {
    setIsFetchingOsmStores(true);
    try {
      const loc = userLocality;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=supermarket+grocery+${encodeURIComponent(loc)}&limit=5&countrycodes=in`
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const parsed = data.map((d: any) => {
            const namePart = d.display_name.split(',')[0] || 'Supermarket';
            return { name: namePart, raw: d };
          });
          setOsmStores(parsed);
          showToast(`Found ${parsed.length} real nearby supermarkets in ${loc}!`, 'success');
        } else {
          showToast(`Loaded ${loc} hyper-local store nodes`, 'info');
        }
      }
    } catch (err) {
      console.error('OSM store search error:', err);
    } finally {
      setIsFetchingOsmStores(false);
    }
  };

  // Live multi-source address search (Local Catalog + Photon + Nominatim)
  const handleAddressSearch = async (query: string) => {
    setSearchQuery(query);
    if (selectedSearchItem && query !== selectedSearchItem.display_name) {
      setSelectedSearchItem(null);
    }
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await executeAddressSearch(query);
      setSearchResults(results);
    } catch (err) {
      console.error('Address search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Helper to handle selecting a search result item and auto-populating House No, Area, City, State, and PIN Code text boxes
  const onSelectAddressSearchResult = (item: any) => {
    setSelectedSearchItem(item);
    setSearchQuery(item.display_name || '');
    setSearchResults([]);

    const displayName = item.display_name || '';
    const addrObj = item.address || {};
    const parsed = item.parsed || {};

    const streetText = parsed.street || addrObj.road || addrObj.suburb || displayName.split(',')[0] || '';
    const areaText = parsed.area || addrObj.suburb || addrObj.neighbourhood || addrObj.road || '';
    const cityText = parsed.city || addrObj.city || addrObj.town || addrObj.village || addrObj.suburb || 'Chennai';
    const stateText = parsed.state || addrObj.state || 'Tamil Nadu';
    const pincodeText = parsed.pincode || addrObj.postcode || '600116';

    if (streetText) setHouseNo(streetText);
    if (areaText) setLandmarkArea(areaText);
    if (cityText) setAddrCity(cityText);

    // Match state in list
    const foundState = INDIAN_STATES.find(s => s.toLowerCase() === stateText.toLowerCase()) || 'Tamil Nadu';
    setAddrState(foundState);

    // Extract PIN code
    let extPincode = pincodeText;
    if (!/^\d{6}$/.test(extPincode)) {
      const match = displayName.match(/\b(\d{6})\b/);
      if (match) extPincode = match[1];
    }
    setAddrPincode(/^\d{6}$/.test(extPincode) ? extPincode : '600116');

    showToast('Address details auto-filled into form!', 'info');
  };

  // Handle saving of new address to Firebase
  const handleSaveAddress = async (e: FormEvent) => {
    e.preventDefault();
    if (!houseNo.trim()) {
      showToast('House No. / Flat / Street details are required.', 'error');
      return;
    }
    if (!addrCity.trim()) {
      showToast('City is required.', 'error');
      return;
    }
    if (!addrState.trim()) {
      showToast('State selection is mandatory.', 'error');
      return;
    }
    if (!addrPincode.trim() || addrPincode.trim().length !== 6 || !/^\d{6}$/.test(addrPincode.trim())) {
      showToast('Please enter a valid 6-digit PIN code.', 'error');
      return;
    }
    if (!receiverName.trim() || !receiverPhone.trim()) {
      showToast('Receiver details are required.', 'error');
      return;
    }

    const cleanPhone = receiverPhone.trim().replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      showToast('Receiver phone number must be exactly 10 digits.', 'error');
      return;
    }

    setIsSavingAddress(true);
    const finalLabel = addressLabel === 'Other' && customLabel.trim() ? customLabel.trim() : addressLabel;
    
    // If editing, use the existing ID; otherwise, generate a new one
    const addressId = editingAddressId || `addr_${Date.now()}`;
    const formattedReceiverPhone = '+91' + cleanPhone;

    try {
      const searchAddrStr = selectedSearchItem 
        ? selectedSearchItem.display_name 
        : `${houseNo.trim()}, ${addrCity.trim()}, ${addrState.trim()} - ${addrPincode.trim()}`;

      const newAddress: SavedAddress = {
        id: addressId,
        searchAddress: searchAddrStr,
        houseNo: houseNo.trim(),
        city: addrCity.trim(),
        state: addrState.trim(),
        pincode: addrPincode.trim(),
        label: finalLabel,
        receiverName: receiverName.trim(),
        receiverPhone: formattedReceiverPhone,
        createdAt: new Date().toISOString()
      };

      if (buildingBlock.trim()) {
        newAddress.buildingBlock = buildingBlock.trim();
      }
      if (landmarkArea.trim()) {
        newAddress.landmarkArea = landmarkArea.trim();
      }

      const custAddrRef = doc(db, 'customer_profiles', currentUser.email, 'addresses', addressId);
      await setDoc(custAddrRef, newAddress, { merge: true });
      try {
        const legacyAddrRef = doc(db, 'profiles', currentUser.email, 'addresses', addressId);
        await setDoc(legacyAddrRef, newAddress, { merge: true });
      } catch (_) {}

      // Refresh list, set active address, and reset state
      await fetchSavedAddresses();
      
      const fullDisplay = `${newAddress.houseNo}, ${newAddress.city}, ${newAddress.state} - ${newAddress.pincode}`;
      setActiveAddressText(fullDisplay);
      setActiveAddressLabel(newAddress.label);
      setActiveAddressDetails(newAddress);

      showToast(editingAddressId ? 'Address updated successfully!' : 'New address saved to your profile!', 'success');
      
      // Reset form fields
      setSearchQuery('');
      setSearchResults([]);
      setSelectedSearchItem(null);
      setHouseNo('');
      setBuildingBlock('');
      setLandmarkArea('');
      setAddrCity('');
      setAddrState('');
      setAddrPincode('');
      setAddressLabel('Home');
      setCustomLabel('');
      setEditingAddressId(null);
      
      // Close modal
      setAddressModalOpen(false);
    } catch (err: any) {
      console.error('Error saving address to Firebase:', err);
      showToast('Failed to save address: ' + err.message, 'error');
    } finally {
      setIsSavingAddress(false);
    }
  };

  // Populate address form fields to edit an address
  const handleStartEdit = (addr: SavedAddress, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent choosing this address as active
    setEditingAddressId(addr.id);
    
    setSearchQuery(addr.searchAddress);
    setSelectedSearchItem({ display_name: addr.searchAddress });
    setHouseNo(addr.houseNo);
    setBuildingBlock(addr.buildingBlock || '');
    setLandmarkArea(addr.landmarkArea || '');
    setAddrCity(addr.city || '');
    setAddrState(addr.state || '');
    setAddrPincode(addr.pincode || '');
    
    const isStandardLabel = ['Home', 'Work'].includes(addr.label);
    if (isStandardLabel) {
      setAddressLabel(addr.label);
      setCustomLabel('');
    } else {
      setAddressLabel('Other');
      setCustomLabel(addr.label);
    }
    
    setReceiverName(addr.receiverName);
    setReceiverPhone(getClean10DigitPhone(addr.receiverPhone));
    
    showToast('Editing address. See form fields below.', 'info');
  };

  // Cancel edit mode and reset form fields
  const handleCancelEdit = () => {
    setEditingAddressId(null);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedSearchItem(null);
    setHouseNo('');
    setBuildingBlock('');
    setLandmarkArea('');
    setAddrCity('');
    setAddrState('');
    setAddrPincode('');
    setAddressLabel('Home');
    setCustomLabel('');
    setReceiverName(currentUser.name);
    setReceiverPhone(getClean10DigitPhone(currentUser.phone));
  };

  // Delete a saved address from subcollection
  const handleDeleteAddress = async (addressId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent choosing this address as active
    try {
      const addrDocRef = doc(db, 'profiles', currentUser.email, 'addresses', addressId);
      await deleteDoc(addrDocRef);
      showToast('Address deleted successfully!', 'success');
      
      // If the deleted address was active, reset it
      if (activeAddressDetails && activeAddressDetails.id === addressId) {
        setActiveAddressText('No active address selected');
        setActiveAddressLabel('Select Node');
        setActiveAddressDetails(null);
      }
      
      // If we are currently editing the deleted address, cancel edit mode
      if (editingAddressId === addressId) {
        handleCancelEdit();
      }

      await fetchSavedAddresses();
    } catch (err: any) {
      console.error('Error deleting address:', err);
      showToast('Failed to delete address: ' + err.message, 'error');
    }
  };

  // Set a saved address as the active one
  const handleSelectSavedAddress = (addr: SavedAddress) => {
    const fullDisplay = `${addr.houseNo}, ${addr.buildingBlock ? addr.buildingBlock + ', ' : ''}${addr.searchAddress}`;
    setActiveAddressText(fullDisplay);
    setActiveAddressLabel(addr.label);
    setActiveAddressDetails(addr);
    setAddressModalOpen(false);
    showToast(`Active address set to: ${addr.label}`, 'success');
  };

  // Handle updating profile details in the same document
  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      showToast('Name is required.', 'error');
      return;
    }

    const cleanPhone = profilePhone.trim().replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      showToast('Profile phone number must be exactly 10 digits.', 'error');
      return;
    }

    if (!profileCity.trim()) {
      showToast('City is required.', 'error');
      return;
    }

    if (!profileState.trim()) {
      showToast('Please select your State.', 'error');
      return;
    }

    if (!profilePincode.trim() || profilePincode.trim().length !== 6 || !/^\d{6}$/.test(profilePincode.trim())) {
      showToast('Please enter a valid 6-digit PIN code.', 'error');
      return;
    }

    if (profileLicense.trim().length > 0) {
      const licVal = validateVehicleRegNumber(profileLicense);
      if (!licVal.isValid) {
        showToast(licVal.error!, 'error');
        return;
      }
    }

    setIsUpdatingProfile(true);
    const formattedPhone = '+91' + cleanPhone;

    try {
      const updatedProfile: UserProfile = {
        ...currentUser,
        name: profileName.trim(),
        phone: formattedPhone,
        address: profileAddress.trim(),
        city: profileCity.trim(),
        state: profileState.trim(),
        pincode: profilePincode.trim(),
        licenseNumber: profileLicense.trim().toUpperCase()
      };

      const payload = {
        name: updatedProfile.name,
        phone: updatedProfile.phone,
        address: updatedProfile.address,
        city: updatedProfile.city,
        state: updatedProfile.state,
        pincode: updatedProfile.pincode,
        licenseNumber: updatedProfile.licenseNumber,
        updatedAt: new Date().toISOString()
      };

      // Set/update the profile document in customer_profiles / rider_profiles and profiles
      const coll = currentUser.userRole === 'rider' ? 'rider_profiles' : 'customer_profiles';
      await setDoc(doc(db, coll, currentUser.email), payload, { merge: true });
      try {
        await setDoc(doc(db, 'profiles', currentUser.email), payload, { merge: true });
      } catch (_) {}

      // Update state and local storage session
      setCurrentUser(updatedProfile);
      localStorage.setItem('dunzo_logistics_session', JSON.stringify(updatedProfile));

      showToast('Profile updated successfully!', 'success');
      setProfileModalOpen(false);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      showToast('Profile update failed: ' + err.message, 'error');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Handle saving mandatory profile and primary address details
  const handleSaveMandatoryProfile = async (e: FormEvent) => {
    e.preventDefault();

    if (!mandatoryName.trim()) {
      showToast('Full Legal Name is required for logistics transparency.', 'error');
      return;
    }

    const cleanPhone = mandatoryPhone.trim().replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      showToast('Please enter a valid 10-digit mobile phone number.', 'error');
      return;
    }

    if (!mandatoryAddress.trim()) {
      showToast('Primary house/street address is mandatory.', 'error');
      return;
    }

    if (!mandatoryCity.trim()) {
      showToast('City is mandatory.', 'error');
      return;
    }

    if (!mandatoryState.trim()) {
      showToast('Please select your State.', 'error');
      return;
    }

    if (!mandatoryPincode.trim() || mandatoryPincode.trim().length !== 6 || !/^\d{6}$/.test(mandatoryPincode.trim())) {
      showToast('Please enter a valid 6-digit PIN code.', 'error');
      return;
    }

    setIsSavingMandatory(true);
    const formattedPhone = '+91' + cleanPhone;
    const houseStreet = mandatoryAddress.trim();
    const cityVal = mandatoryCity.trim();
    const stateVal = mandatoryState.trim();
    const pinVal = mandatoryPincode.trim();
    const finalAddress = `${houseStreet}, ${cityVal}, ${stateVal} - ${pinVal}`;

    try {
      const updatedUser: UserProfile = {
        ...currentUser,
        name: mandatoryName.trim(),
        phone: formattedPhone,
        address: finalAddress,
        city: cityVal,
        state: stateVal,
        pincode: pinVal
      };

      const payload = {
        name: updatedUser.name,
        phone: updatedUser.phone,
        address: updatedUser.address,
        city: updatedUser.city,
        state: updatedUser.state,
        pincode: updatedUser.pincode,
        userRole: 'customer',
        updatedAt: new Date().toISOString()
      };

      // 1. Save to customer_profiles and legacy profiles in Firestore
      await setDoc(doc(db, 'customer_profiles', currentUser.email), payload, { merge: true });
      try {
        await setDoc(doc(db, 'profiles', currentUser.email), payload, { merge: true });
      } catch (_) {}

      // 2. Save primary address entry to subcollection
      const primaryAddrRef = doc(db, 'customer_profiles', currentUser.email, 'addresses', 'primary_home');
      const savedAddrObj: SavedAddress = {
        id: 'primary_home',
        searchAddress: finalAddress,
        houseNo: houseStreet,
        city: cityVal,
        state: stateVal,
        pincode: pinVal,
        label: 'Primary Address',
        receiverName: updatedUser.name,
        receiverPhone: updatedUser.phone,
        createdAt: new Date().toISOString()
      };
      await setDoc(primaryAddrRef, savedAddrObj, { merge: true });
      try {
        await setDoc(doc(db, 'profiles', currentUser.email, 'addresses', 'primary_home'), savedAddrObj, { merge: true });
      } catch (_) {}

      // 3. Update session, state, and clear pending onboarding flag
      localStorage.removeItem('dunzo_customer_onboarding_pending_' + currentUser.email);
      localStorage.setItem('dunzo_logistics_session', JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);

      setActiveAddressText(finalAddress);
      setActiveAddressLabel('Primary Address');
      setActiveAddressDetails(savedAddrObj);

      await fetchSavedAddresses();

      showToast('Primary address and profile details updated successfully!', 'success');
      setMandatoryModalOpen(false);
    } catch (err: any) {
      console.error('Error updating mandatory profile details:', err);
      showToast('Failed to save mandatory profile details: ' + err.message, 'error');
    } finally {
      setIsSavingMandatory(false);
    }
  };

  // Reset/sync profile fields with latest currentUser
  const openProfileModal = () => {
    setProfileName(currentUser.name);
    setProfilePhone(getClean10DigitPhone(currentUser.phone));
    setProfileAddress(currentUser.address);
    setProfileCity(currentUser.city || '');
    setProfileState(currentUser.state || '');
    setProfilePincode(currentUser.pincode || '');
    setProfileLicense(currentUser.licenseNumber ? formatVehicleRegNumber(currentUser.licenseNumber) : '');
    setProfileSearchQuery('');
    setProfileSearchResults([]);
    setProfileModalOpen(true);
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* 1. Header Navigation Bar */}
      <header className="sticky top-0 z-30 w-full bg-black border-b-2 border-black px-4 sm:px-6 md:px-8 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_4px_0_rgba(0,0,0,1)] text-white">
        
        {/* Logo & Actions row (for mobile) / Left side (for desktop) */}
        <div className="flex items-center justify-between sm:justify-start gap-4 shrink-0">
          {/* Custom Vector Dunzo D-Truck Logo */}
          <div className="bg-black px-4 py-2 rounded-xl border-2 border-white/20 flex items-center justify-center shadow-[2px_2px_0px_rgba(0,0,0,1)] select-none">
            <ProjectDunzoLogo className="h-8 sm:h-10 w-auto" />
          </div>

          {/* Profile & Logout buttons on mobile */}
          <div className="flex items-center gap-2 sm:hidden">
            <button
              onClick={openProfileModal}
              title="Profile"
              className="flex items-center justify-center p-2 border-2 border-black bg-white rounded-lg hover:bg-neutral-100 transition-all text-black cursor-pointer shadow-[2px_2px_0px_rgba(0,0,0,1)]"
            >
              <User className="w-4 h-4" />
            </button>
            <button
              onClick={handleSignOut}
              title="Log Out"
              className="flex items-center justify-center p-2 border-2 border-black bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all cursor-pointer shadow-[2px_2px_0px_rgba(0,0,0,1)]"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center: Geolocation / Address Trigger Button */}
        <button
          id="address-selector-btn"
          onClick={() => setAddressModalOpen(true)}
          className="w-full sm:w-auto sm:flex-1 sm:max-w-md md:max-w-lg lg:max-w-xl flex items-center gap-3 px-3.5 py-2 border-2 border-black bg-white hover:bg-neutral-50 rounded-xl transition-all text-left cursor-pointer min-w-0 shadow-[2px_2px_0px_rgba(0,0,0,1)] group"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#00E181] text-black border border-black font-bold shrink-0 shadow-[1px_1px_0px_rgba(0,0,0,1)] group-hover:bg-emerald-400 transition-colors">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[10px] font-black text-[#00AF62] uppercase tracking-wider leading-none flex items-center gap-1.5">
              <span>DELIVERY LOCATION</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#00E181] animate-pulse"></span>
            </span>
            <div className="flex items-center gap-2 min-w-0 mt-0.5">
              <span className="text-[11px] font-black text-black shrink-0">
                {activeAddressLabel}
              </span>
              <span className="text-xs font-bold truncate text-neutral-800 flex-1">
                {activeAddressText}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-black shrink-0" />
            </div>
          </div>
        </button>

        {/* Right Side: Profile & Logout buttons */}
        <div className="hidden sm:flex items-center gap-2.5 shrink-0">
          <button
            id="profile-btn"
            onClick={openProfileModal}
            className="flex items-center gap-2 px-3.5 py-2 border-2 border-black bg-white hover:bg-neutral-100 transition-all font-black text-xs text-black rounded-xl shadow-[2px_2px_0px_rgba(0,0,0,1)] cursor-pointer"
          >
            <User className="w-4 h-4 text-black" />
            <span>Profile</span>
          </button>

          <button
            id="logout-btn"
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3.5 py-2 border-2 border-black bg-red-500 hover:bg-red-600 text-white transition-all font-black text-xs rounded-xl shadow-[2px_2px_0px_rgba(0,0,0,1)] cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-white" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* 1.5 Header Navigation Menu Bar */}
      <div className="w-full bg-neutral-900 border-b-2 border-black px-4 sm:px-6 md:px-8 py-2.5 z-20">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab('services');
                setSelectedService(null);
              }}
              className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'services'
                  ? 'bg-[#00E181] text-black border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]'
                  : 'bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700 hover:text-white'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Services Menu</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('dispatches');
              }}
              className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'dispatches'
                  ? 'bg-[#00E181] text-black border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]'
                  : 'bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700 hover:text-white'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Active Dispatches</span>
              <span className={`ml-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${
                activeTab === 'dispatches'
                  ? 'bg-black text-[#00E181] border-black'
                  : 'bg-neutral-700 text-neutral-200 border-neutral-600'
              }`}>
                {dispatches.length}
              </span>
            </button>
          </div>

          {activeTab === 'services' && selectedService !== null && (
            <button
              onClick={() => setSelectedService(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-black bg-white hover:bg-neutral-100 text-black font-black rounded-xl text-xs transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)] cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Services</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Area: Retro-modern high-contrast dashboard */}
      {activeTab === 'dispatches' ? (
        /* Standalone Active Dispatches Screen in Menu Option */
        <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6 animate-fadeIn">
          <div className="bg-white border border-slate-200/90 p-5 sm:p-7 rounded-2xl shadow-sm flex-1 flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 font-semibold shadow-xs">
                  <Activity className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">TELEMETRY GRID</span>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight mt-0.5">
                    Active Dispatches ({dispatches.length})
                  </h2>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium bg-slate-100 border border-slate-200 px-3 py-1 rounded-full text-slate-600">
                  Realtime Monitoring
                </span>
                <button
                  onClick={() => {
                    setActiveTab('services');
                    setSelectedService(null);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Errand</span>
                </button>
              </div>
            </div>

            {dispatches.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-10 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 min-h-52">
                <Package className="w-10 h-10 text-slate-300 stroke-[1.5] mb-2" />
                <p className="text-sm font-semibold text-slate-500">No active tracking nodes</p>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  Select a service from the menu options to dispatch a hyperlocal errand agent and watch live status.
                </p>
                <button
                  onClick={() => {
                    setActiveTab('services');
                    setSelectedService(null);
                  }}
                  className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  Select a Service
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-1">
                {dispatches.map((disp) => {
                  const isDelivered = disp.status === 'delivered';
                  const priorityColors = 
                    disp.priority === 'CRITICAL' ? 'bg-red-50 text-red-700 border-red-200' :
                    disp.priority === 'EXPRESS' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                    'bg-emerald-50 text-emerald-800 border-emerald-200';

                  return (
                    <div
                      key={disp.id}
                      className="border border-slate-200 bg-white rounded-2xl p-4 shadow-xs hover:shadow-sm flex flex-col gap-3 relative overflow-hidden transition-all"
                    >
                      {/* Priority and category indicators */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-semibold border px-2.5 py-0.5 rounded-full ${priorityColors}`}>
                            {disp.priority}
                          </span>
                          <span className="text-[10px] font-medium text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                            {disp.category}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-400 font-mono">
                          #{disp.id}
                        </span>
                      </div>

                      {/* Path representation */}
                      <div className="flex flex-col gap-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                          <span className="truncate"><span className="font-semibold text-slate-800">From:</span> {disp.pickupAddress}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                          <span className="truncate"><span className="font-semibold text-slate-800">To:</span> {disp.dropAddress}</span>
                        </div>
                      </div>

                      {/* Progress slider / stats */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                          <span className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${isDelivered ? 'bg-emerald-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                            Status: <span className="text-slate-900 capitalize font-bold">{disp.status}</span>
                          </span>
                          <span className="font-mono text-slate-700">{disp.progress}%</span>
                        </div>
                        
                        {/* Custom progress bar */}
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-700"
                            style={{ width: `${disp.progress}%` }}
                          />
                        </div>

                        {/* Estimated details */}
                        <div className="flex justify-between items-center text-xs text-slate-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Est: {disp.estimatedTime}m / {disp.elapsedTime}m
                          </span>
                          <span className="text-slate-800 font-semibold truncate max-w-[170px]">
                            {disp.agentName.split(' ')[0]} ({disp.agentPhone})
                          </span>
                        </div>
                      </div>

                      {/* Cancel/Term button */}
                      <button
                        onClick={() => handleCancelDispatch(disp.id)}
                        className="absolute right-3 top-3 p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
                        title="Remove tracking"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      ) : selectedService !== null ? (
        /* When clicking on each service button, show form only! */
        <main className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6 lg:p-8 animate-fadeIn">
          <div className="bg-white border border-slate-200/90 p-6 sm:p-8 rounded-2xl shadow-sm flex flex-col gap-5">
            {/* Service Builder Forms */}
            <div className="flex flex-col gap-5">
              {/* Back to selection header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedService(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Services</span>
                </button>
                <div className="text-right flex flex-col items-end">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Service Console</span>
                  <span className="text-xs font-bold text-slate-900 mt-0.5">
                    {selectedService === 'grocery' && 'Grocery Checkout'}
                    {selectedService === 'courier' && 'Courier Dispatcher'}
                    {selectedService === 'boutique' && 'Boutique Clothing Order'}
                    {selectedService === 'concierge' && 'Concierge Assistance Setup'}
                  </span>
                </div>
              </div>

              {/* 1. Grocery Checkout Builder Form */}
              {selectedService === 'grocery' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (selectedGroceryItems.length === 0) {
                      showToast('Please select at least one grocery item to order!', 'error');
                      return;
                    }
                    handleLaunchServiceDispatch('grocery', {
                      category: 'Grocery',
                      pickupAddress: `${selectedGroceryStore} (Dunzo Node)`,
                      dropAddress: activeAddressText || 'My Address',
                      priority: launchPriority,
                      detailsText: `Bought ${selectedGroceryItems.join(', ')} from ${selectedGroceryStore}`
                    });
                  }}
                  className="flex flex-col gap-4"
                >
                  {/* Dynamic Hyper-Local Store Selector with Live Zero-Cost OSM Search */}
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-700 tracking-wider uppercase block">
                        SELECT NEARBY STORE / DARK STORE
                      </label>
                      <button
                        type="button"
                        onClick={fetchNearbyOsmSupermarkets}
                        disabled={isFetchingOsmStores}
                        className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs hover:bg-emerald-100"
                      >
                        {isFetchingOsmStores ? (
                          <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                        ) : (
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                        )}
                        <span>Fetch Live Stores (Zero Cost)</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-medium text-slate-700 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Showing stores near <strong className="text-slate-900">{userLocality}</strong> (within 3 km)</span>
                    </div>

                    {/* Store Cards List */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                      {getDynamicGroceryStores().map((store) => {
                        const isSelected = selectedGroceryStore === store.name;
                        return (
                          <div
                            key={store.id || store.name}
                            onClick={() => setSelectedGroceryStore(store.name)}
                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-1.5 ${
                              isSelected
                                ? 'bg-emerald-50/90 border-emerald-500 shadow-xs ring-2 ring-emerald-500/20'
                                : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className="text-xs font-bold text-slate-900 leading-snug">{store.name}</span>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded shrink-0">
                                {store.tag}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium pt-1 border-t border-slate-100">
                              <span>{store.desc}</span>
                              <span className="font-mono font-bold text-slate-700">{store.distance}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pre-populated Groceries Checklist */}
                  <div>
                    <label className="text-[10px] font-semibold text-emerald-700 tracking-wider uppercase mb-1.5 block">Select Items to Purchase</label>
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                      {[
                        { name: 'Fresh Organic Bananas (1 Dozen)', price: 60 },
                        { name: 'Hass Avocados (Pack of 2)', price: 180 },
                        { name: 'Farm Fresh Milk (1 Litre)', price: 50 },
                        { name: 'Whole Wheat Sourdough Bread', price: 80 },
                        { name: 'Gourmet Dark Chocolate Bar', price: 120 }
                      ].map((item) => {
                        const isChecked = selectedGroceryItems.includes(item.name);
                        return (
                          <label
                            key={item.name}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                              isChecked ? 'bg-emerald-50/80 border-emerald-300 text-slate-900 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedGroceryItems(prev => prev.filter(i => i !== item.name));
                                  } else {
                                    setSelectedGroceryItems(prev => [...prev, item.name]);
                                  }
                                }}
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20 cursor-pointer"
                              />
                              <span>{item.name}</span>
                            </div>
                            <span className="font-mono font-semibold text-slate-900">₹{item.price}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Priority Selector */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase mb-1.5 block">Delivery Speed Priority</label>
                    <div className="flex gap-2">
                      {(['STANDARD', 'EXPRESS', 'CRITICAL'] as const).map((pr) => {
                        const isActive = launchPriority === pr;
                        return (
                          <button
                            key={pr}
                            type="button"
                            onClick={() => setLaunchPriority(pr)}
                            className={`flex-1 py-2 rounded-xl border text-xs font-semibold uppercase transition-all cursor-pointer ${
                              isActive
                                ? pr === 'CRITICAL'
                                  ? 'bg-red-600 text-white border-red-600 shadow-xs'
                                  : pr === 'EXPRESS'
                                  ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                                  : 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                          >
                            {pr}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-semibold text-xs tracking-wider uppercase shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>Launch Grocery Run (₹{selectedGroceryItems.reduce((acc, curr) => {
                      const priceMap: { [key: string]: number } = {
                        'Fresh Organic Bananas (1 Dozen)': 60,
                        'Hass Avocados (Pack of 2)': 180,
                        'Farm Fresh Milk (1 Litre)': 50,
                        'Whole Wheat Sourdough Bread': 80,
                        'Gourmet Dark Chocolate Bar': 120
                      };
                      return acc + (priceMap[curr] || 0);
                    }, 0)} + Del)</span>
                  </button>
                </form>
              )}

              {/* 2. Courier Pick & Drop Builder Form */}
              {selectedService === 'courier' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!courierPickupInput.trim() || !courierDropInput.trim()) {
                      showToast('Please specify both pickup and drop addresses!', 'error');
                      return;
                    }
                    handleLaunchServiceDispatch('courier', {
                      category: 'Courier',
                      pickupAddress: courierPickupInput,
                      dropAddress: courierDropInput,
                      priority: launchPriority,
                      detailsText: `Sent package: ${courierItemDesc || 'General Parcel'} (${courierWeightClass} weight)`
                    });
                  }}
                  className="flex flex-col gap-4"
                >
                  {/* Pickup point */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase mb-1.5 block">Pickup Point Address</label>
                    <input
                      type="text"
                      value={courierPickupInput}
                      onChange={(e) => setCourierPickupInput(e.target.value)}
                      placeholder="e.g., Flat 204, Indiranagar Orchards"
                      className="w-full px-3.5 py-2.5 text-xs font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white shadow-xs"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setCourierPickupInput(activeAddressText || '')}
                      className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 underline tracking-wide mt-1 cursor-pointer block text-left"
                    >
                      Use current active location
                    </button>
                  </div>

                  {/* Drop point */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase mb-1.5 block">Drop-Off Destination</label>
                    <input
                      type="text"
                      value={courierDropInput}
                      onChange={(e) => setCourierDropInput(e.target.value)}
                      placeholder="e.g., Koramangala IT Hub, Tower C"
                      className="w-full px-3.5 py-2.5 text-xs font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white shadow-xs"
                      required
                    />
                  </div>

                  {/* Package contents description */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase mb-1.5 block">What is being delivered?</label>
                    <input
                      type="text"
                      value={courierItemDesc}
                      onChange={(e) => setCourierItemDesc(e.target.value)}
                      placeholder="e.g., Keys, Laptop charger, Office documents"
                      className="w-full px-3.5 py-2.5 text-xs font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white shadow-xs"
                      required
                    />
                  </div>

                  {/* Weight class selection */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase mb-1.5 block">Approximate Weight</label>
                    <div className="flex gap-2">
                      {(['LIGHT', 'MEDIUM', 'HEAVY'] as const).map((w) => {
                        const isWeightActive = courierWeightClass === w;
                        return (
                          <button
                            key={w}
                            type="button"
                            onClick={() => setCourierWeightClass(w)}
                            className={`flex-1 py-2 rounded-xl border text-xs font-semibold uppercase transition-all cursor-pointer ${
                              isWeightActive ? 'bg-slate-900 text-white border-slate-900 shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {w === 'LIGHT' && '< 1 KG'}
                            {w === 'MEDIUM' && '1-5 KG'}
                            {w === 'HEAVY' && '> 5 KG'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Priority Selector */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase mb-1.5 block">Courier Urgency</label>
                    <div className="flex gap-2">
                      {(['STANDARD', 'EXPRESS', 'CRITICAL'] as const).map((pr) => {
                        const isActive = launchPriority === pr;
                        return (
                          <button
                            key={pr}
                            type="button"
                            onClick={() => setLaunchPriority(pr)}
                            className={`flex-1 py-2 rounded-xl border text-xs font-semibold uppercase transition-all cursor-pointer ${
                              isActive
                                ? pr === 'CRITICAL'
                                  ? 'bg-red-600 text-white border-red-600 shadow-xs'
                                  : pr === 'EXPRESS'
                                  ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                                  : 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                          >
                            {pr}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-semibold text-xs tracking-wider uppercase shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    <Truck className="w-4 h-4 text-emerald-400" />
                    <span>Launch Courier Dispatch</span>
                  </button>
                </form>
              )}

              {/* 3. Small Business Boutique Builder Form */}
              {selectedService === 'boutique' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (selectedBoutiqueItems.length === 0) {
                      showToast('Please select at least one garment brand item to buy!', 'error');
                      return;
                    }
                    handleLaunchServiceDispatch('boutique', {
                      category: 'Boutique',
                      pickupAddress: `${selectedBoutiqueBrand} Shop Node`,
                      dropAddress: activeAddressText || 'My Address',
                      priority: launchPriority,
                      detailsText: `Bought ${selectedBoutiqueItems.join(', ')} (Size ${boutiqueItemSize}) from Boutique brand`
                    });
                  }}
                  className="flex flex-col gap-4"
                >
                  {/* Boutique brand */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase mb-1.5 block">Select Independent Fashion Brand</label>
                    <select
                      value={selectedBoutiqueBrand}
                      onChange={(e) => setSelectedBoutiqueBrand(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white cursor-pointer shadow-xs"
                    >
                      <option value="Bengaluru Handloom Society">Bengaluru Handloom Society (Cotton/Khadi)</option>
                      <option value="Indiranagar Vintage Thread Club">Indiranagar Vintage Thread Club (Thrift/Denims)</option>
                      <option value="Koramangala Linen Studio">Koramangala Linen Studio (Premium Basics)</option>
                    </select>
                  </div>

                  {/* Clothing catalog items */}
                  <div>
                    <label className="text-[10px] font-semibold text-purple-700 tracking-wider uppercase mb-1.5 block">Select Clothes to Purchase</label>
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                      {[
                        { name: 'Handloomed Indigo Shirt', price: 1490 },
                        { name: 'Organic Linen Summer Dress', price: 2100 },
                        { name: 'Oversized Heavyweight Hoodie', price: 1850 },
                        { name: 'Organic Cotton Chino Trousers', price: 1600 }
                      ].map((item) => {
                        const isChecked = selectedBoutiqueItems.includes(item.name);
                        return (
                          <label
                            key={item.name}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                              isChecked ? 'bg-purple-50/80 border-purple-300 text-slate-900 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedBoutiqueItems(prev => prev.filter(i => i !== item.name));
                                  } else {
                                    setSelectedBoutiqueItems(prev => [...prev, item.name]);
                                  }
                                }}
                                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500/20 cursor-pointer"
                              />
                              <span>{item.name}</span>
                            </div>
                            <span className="font-mono font-semibold text-slate-900">₹{item.price}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Apparel Size selector */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase mb-1.5 block">Choose Garment Size</label>
                    <div className="flex gap-2">
                      {(['S', 'M', 'L', 'XL'] as const).map((sz) => {
                        const isSizeActive = boutiqueItemSize === sz;
                        return (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => setBoutiqueItemSize(sz)}
                            className={`flex-1 py-1.5 px-2 rounded-xl border text-xs font-semibold uppercase transition-all cursor-pointer ${
                              isSizeActive ? 'bg-purple-600 text-white border-purple-600 shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {sz}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Delivery notice */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-600">
                    🚚 Shipping directly to: <span className="text-slate-900 font-semibold">{activeAddressText}</span>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-semibold text-xs tracking-wider uppercase shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    <Shirt className="w-4 h-4 text-emerald-100 shrink-0" />
                    <span>Order Clothes (Total: ₹{selectedBoutiqueItems.reduce((acc, curr) => {
                      const priceMap: { [key: string]: number } = {
                        'Handloomed Indigo Shirt': 1490,
                        'Organic Linen Summer Dress': 2100,
                        'Oversized Heavyweight Hoodie': 1850,
                        'Organic Cotton Chino Trousers': 1600
                      };
                      return acc + (priceMap[curr] || 0);
                    }, 0)})</span>
                  </button>
                </form>
              )}

              {/* 4. Elder Care / Concierge Setup Builder Form */}
              {selectedService === 'concierge' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleLaunchServiceDispatch('concierge', {
                      category: 'Concierge',
                      pickupAddress: activeAddressText || 'Patient Residence',
                      dropAddress: conciergeSpecialty === 'Senior Care Medical Escort' ? 'Apollo Clinic Hub' : 'Specified Government Center',
                      priority: 'EXPRESS',
                      detailsText: `${conciergeSpecialty} for ${conciergeHours} hrs (${conciergeNurseCertified ? 'Nurse Certified' : 'Standard'}). Instruction: ${conciergeInstructions || 'None'}`
                    });
                  }}
                  className="flex flex-col gap-4"
                >
                  {/* Specialty selection */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase mb-1.5 block">Choose Concierge Specialty</label>
                    <select
                      value={conciergeSpecialty}
                      onChange={(e) => setConciergeSpecialty(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white cursor-pointer shadow-xs"
                    >
                      <option value="Senior Care Medical Escort">Senior Care Medical Escort (Doctor checkup support)</option>
                      <option value="Bureaucratic / Chore Assistance">Bureaucratic Chore Escort (Offline bills/banking)</option>
                      <option value="Personal Specialty Shopper">Personal Specialty Shopper (Handpicked boutique errand)</option>
                    </select>
                  </div>

                  {/* Hours required */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase mb-1.5 block">Service Booking Duration</label>
                    <div className="flex gap-2">
                      {([2, 4, 8] as const).map((hr) => {
                        const isHourActive = conciergeHours === hr;
                        return (
                          <button
                            key={hr}
                            type="button"
                            onClick={() => setConciergeHours(hr)}
                            className={`flex-1 py-2 rounded-xl border text-xs font-semibold uppercase transition-all cursor-pointer ${
                              isHourActive ? 'bg-amber-500 text-white border-amber-500 shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {hr} Hours
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Nurse Toggle Certified */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-900">Nurse-Certified Companion</span>
                      <span className="text-[10px] text-slate-500 font-medium mt-0.5">Requisite for clinical checkups (+₹400)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={conciergeNurseCertified}
                      onChange={(e) => setConciergeNurseCertified(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500/20 cursor-pointer"
                    />
                  </div>

                  {/* Special Instructions */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase mb-1.5 block">Patient Instructions / Assistance Notes</label>
                    <textarea
                      value={conciergeInstructions}
                      onChange={(e) => setConciergeInstructions(e.target.value)}
                      placeholder="e.g. Needs wheelchair assistance, companion should pick up medicines from Apollo counter."
                      className="w-full px-3.5 py-2.5 text-xs font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white h-20 resize-none shadow-xs"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-semibold text-xs tracking-wider uppercase shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    <HeartHandshake className="w-4 h-4 shrink-0" />
                    <span>Book Concierge (Rate: ₹{conciergeHours === 2 ? 400 : (conciergeHours === 4 ? 750 : 1500) + (conciergeNurseCertified ? 400 : 0)})</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </main>
      ) : (
        /* Main Screen: Clean single-column layout focusing purely on Service Selection */
        <main className="flex-1 w-full max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 animate-fadeIn">
          {/* Interactive Errand Launcher & Service Selector */}
          <section className="flex flex-col gap-6 sm:gap-8">
            <div className="bg-white border-2 sm:border-3 border-black p-5 sm:p-7 rounded-2xl shadow-[4px_4px_0px_rgba(0,0,0,1)] flex flex-col gap-5">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1 pb-3.5 border-b-2 border-dashed border-neutral-200">
                  <span className="text-[10px] font-black tracking-wider text-[#00AF62] uppercase">HYPERLOCAL SERVICE SELECTOR</span>
                  <h3 className="text-base font-black text-black uppercase tracking-tight mt-0.5">Select a Service</h3>
                  <p className="text-xs text-neutral-600 font-medium mt-0.5">
                    Choose a specialized service below to configure and launch your custom hyperlocal errand run.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 1. Grocery Card */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedService('grocery');
                      setLaunchPriority('STANDARD');
                    }}
                    className="w-full text-left bg-white hover:bg-neutral-50 border-2 border-black p-4.5 rounded-xl shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] active:translate-y-[1px] transition-all flex items-start gap-4 cursor-pointer group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#00E181] border-2 border-black flex items-center justify-center text-black font-black shrink-0 shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)]">
                      <ShoppingCart className="w-5.5 h-5.5" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-black tracking-tight">1. INSTANT GROCERY DELIVERY</h4>
                        <span className="text-[9px] font-black bg-[#00E181] text-black px-2 py-0.5 rounded border border-black shadow-[1px_1px_0px_rgba(0,0,0,1)]">FASTEST</span>
                      </div>
                      <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                        Order fresh fruits, organic produce, snacks & daily dairy items instantly from nearest partner store.
                      </p>
                    </div>
                  </button>

                  {/* 2. Courier Card */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedService('courier');
                      setLaunchPriority('STANDARD');
                    }}
                    className="w-full text-left bg-white hover:bg-neutral-50 border-2 border-black p-4.5 rounded-xl shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] active:translate-y-[1px] transition-all flex items-start gap-4 cursor-pointer group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-blue-100 border-2 border-black flex items-center justify-center text-blue-900 font-black shrink-0 shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)]">
                      <ArrowLeftRight className="w-5.5 h-5.5" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-black tracking-tight">2. COURIER PICK & DROP</h4>
                        <span className="text-[9px] font-black bg-blue-200 text-blue-900 px-2 py-0.5 rounded border border-black shadow-[1px_1px_0px_rgba(0,0,0,1)]">COURIER</span>
                      </div>
                      <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                        Send keys, documents, chargers, clothes, or meals securely from custom pickup to drop-off coordinates.
                      </p>
                    </div>
                  </button>

                  {/* 3. Small Business Boutique */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedService('boutique');
                      setLaunchPriority('STANDARD');
                    }}
                    className="w-full text-left bg-white hover:bg-neutral-50 border-2 border-black p-4.5 rounded-xl shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] active:translate-y-[1px] transition-all flex items-start gap-4 cursor-pointer group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-purple-100 border-2 border-black flex items-center justify-center text-purple-900 font-black shrink-0 shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)]">
                      <Shirt className="w-5.5 h-5.5" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-black tracking-tight">3. PURCHASE FROM SMALL BRANDS</h4>
                        <span className="text-[9px] font-black bg-purple-200 text-purple-900 px-2 py-0.5 rounded border border-black shadow-[1px_1px_0px_rgba(0,0,0,1)]">BOUTIQUE</span>
                      </div>
                      <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                        Shop linen items, curated shirts, and limited garments from independent regional small boutiques.
                      </p>
                    </div>
                  </button>

                  {/* 4. Caretaker Companion */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedService('concierge');
                      setLaunchPriority('EXPRESS');
                    }}
                    className="w-full text-left bg-white hover:bg-neutral-50 border-2 border-black p-4.5 rounded-xl shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] active:translate-y-[1px] transition-all flex items-start gap-4 cursor-pointer group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-amber-200 border-2 border-black flex items-center justify-center text-black font-black shrink-0 shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)]">
                      <HeartHandshake className="w-5.5 h-5.5" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-black tracking-tight">4. PERSONAL CONCIERGE & CARE</h4>
                        <span className="text-[9px] font-black bg-amber-400 text-black px-2 py-0.5 rounded border border-black shadow-[1px_1px_0px_rgba(0,0,0,1)]">ASSISTANCE</span>
                      </div>
                      <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                        Assign a specialized caretaker companion to escort elders to doctors, clinics, or manage personal offline chores.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* 2.5 Dynamic Footer */}
      <footer className="w-full bg-slate-900 text-slate-400 border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-white font-bold text-xs tracking-wider uppercase">Project Dunzo Logistics Network</span>
            </div>
            <p className="text-xs text-slate-400 font-normal text-center md:text-left mt-1 max-w-sm">
              Hyperlocal logistics coordination grid. Powered by Cloud Firestore persistent state and device geolocation telemetry.
            </p>
          </div>

          {/* Quick status signals */}
          <div className="flex flex-wrap items-center justify-center gap-3 font-mono text-[10px] font-semibold">
            <span className="bg-slate-800 border border-slate-700/80 text-slate-300 px-2.5 py-1 rounded-md">
              GATEWAY: SECURE
            </span>
            <span className="bg-slate-800 border border-slate-700/80 text-emerald-400 px-2.5 py-1 rounded-md">
              CH_INTEGRITY: 100%
            </span>
            <span className="bg-slate-800 border border-slate-700/80 text-blue-400 px-2.5 py-1 rounded-md">
              EST_LATENCY: 12ms
            </span>
          </div>

          <div className="text-center md:text-right text-xs text-slate-400 font-normal flex flex-col gap-1">
            <span>© 2026 Dunzo Logistics Portal. All rights reserved.</span>
            <div className="flex items-center justify-center md:justify-end gap-3 text-slate-400 text-xs">
              <span className="hover:text-white transition-colors cursor-pointer">Ecosystem Policy</span>
              <span>•</span>
              <span className="hover:text-white transition-colors cursor-pointer">Node Console</span>
            </div>
          </div>
        </div>
      </footer>

      {/* 3. SAVED ADDRESS & ADD ADDRESS MODAL */}
      {addressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-fadeIn my-4 sm:my-8">
            
            {/* Header */}
            <div className="bg-slate-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Navigation className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm tracking-tight">Select or Add Address</h3>
              </div>
              <button
                onClick={() => setAddressModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Inner Content */}
            <div className="p-5 sm:p-6 max-h-[80vh] overflow-y-auto flex flex-col gap-5 sm:gap-6">
              
              {/* Geolocation Trigger */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">GPS Selection</label>
                <button
                  onClick={() => {
                    detectLocation();
                    setAddressModalOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 py-3 rounded-xl font-semibold text-xs transition-all cursor-pointer shadow-xs"
                >
                  <Compass className="w-4 h-4 text-emerald-600" />
                  <span>Use Current Location as Delivery Address</span>
                </button>
              </div>

              {/* Previously Saved Addresses */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">Previously Saved Addresses ({savedAddresses.length})</label>
                
                {loadingAddresses ? (
                  <div className="flex items-center justify-center py-4 gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                    <span className="text-xs font-medium text-slate-500">Loading saved addresses...</span>
                  </div>
                ) : savedAddresses.length === 0 ? (
                  <div className="text-center p-4 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-xs text-slate-500 font-medium">
                    No previously saved addresses. Use the search bar below to add one!
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                    {savedAddresses.map((addr) => (
                      <div
                        key={addr.id}
                        className="w-full text-left p-3 border border-slate-200 bg-white rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-all flex items-start justify-between gap-3 shadow-xs"
                      >
                        <div
                          onClick={() => handleSelectSavedAddress(addr)}
                          className="min-w-0 flex-1 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded uppercase">[{addr.label}]</span>
                            <span className="text-xs font-semibold text-slate-900">{addr.houseNo}</span>
                          </div>
                          <p className="text-xs text-slate-600 font-normal truncate mt-1">{addr.searchAddress}</p>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">For: {addr.receiverName} ({addr.receiverPhone})</p>
                        </div>
                        
                        <div className="flex items-center gap-1.5 shrink-0 self-center">
                          <button
                            type="button"
                            onClick={(e) => handleStartEdit(addr, e)}
                            title="Edit Address"
                            className="p-1.5 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition-all flex items-center justify-center cursor-pointer shadow-xs"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteAddress(addr.id, e)}
                            title="Delete Address"
                            className="p-1.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-all flex items-center justify-center cursor-pointer shadow-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="relative flex items-center justify-center py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <span className="relative bg-white px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {editingAddressId ? 'Edit Saved Address' : 'Add a New Address'}
                </span>
              </div>

              {/* Form with Search Bar & Custom Fallback */}
              <form onSubmit={handleSaveAddress} className="flex flex-col gap-4">
                
                {/* Search Input Box */}
                <div className="relative">
                  <label className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mb-1 block">Search Address</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      {isSearching ? <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> : <Search className="w-4 h-4" />}
                    </span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleAddressSearch(e.target.value)}
                      placeholder="Search road, apartment, area, or city..."
                      className="w-full pl-10 pr-4 py-2.5 text-xs font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white transition-all shadow-xs"
                    />
                  </div>

                  {/* Dynamic suggestions drop-down */}
                  {!selectedSearchItem && searchQuery.trim().length >= 3 && (
                    <div className="absolute top-full left-0 right-0 z-40 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                      {/* Direct manual text fallback option */}
                      <button
                        type="button"
                        onClick={() => {
                          onSelectAddressSearchResult({ display_name: searchQuery });
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-b border-slate-200 transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <Plus className="w-4 h-4 shrink-0" />
                        <span>Use precisely as typed: "{searchQuery}"</span>
                      </button>

                      {searchResults.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            onSelectAddressSearchResult(item);
                          }}
                          className="w-full text-left px-4 py-2 text-xs font-normal text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-all flex items-start gap-2 cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{item.display_name}</span>
                        </button>
                      ))}

                      {searchResults.length === 0 && !isSearching && (
                        <div className="p-3 text-center text-xs text-slate-400 font-normal">
                          No suggestions found. Click "Use precisely as typed" above to input manually!
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Always render address detail form fields so user can fill manually or via search */}
                <div className="flex flex-col gap-4 bg-slate-50 p-4 border border-slate-200 rounded-xl animate-fadeIn">
                  
                  {selectedSearchItem && (
                    <div className="flex items-start gap-2 text-xs text-slate-700 font-medium bg-emerald-50 p-2.5 rounded-lg border border-emerald-200/80">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-900">Search Selected:</span> {selectedSearchItem.display_name}
                      </div>
                    </div>
                  )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* House No. and Floor (Required) */}
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mb-1 block">HOUSE NO. & FLOOR *</label>
                        <input
                          type="text"
                          required
                          value={houseNo}
                          onChange={(e) => setHouseNo(e.target.value)}
                          placeholder="e.g. Flat 405, 4th Floor"
                          className="w-full px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white transition-all"
                        />
                      </div>

                      {/* Building and Block No (Optional) */}
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mb-1 block">BUILDING & BLOCK (OPTIONAL)</label>
                        <input
                          type="text"
                          value={buildingBlock}
                          onChange={(e) => setBuildingBlock(e.target.value)}
                          placeholder="e.g. Tower B, Palm Heights"
                          className="w-full px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Landmark and Area Name (Optional) */}
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mb-1 block">LANDMARK & AREA NAME (OPTIONAL)</label>
                        <input
                          type="text"
                          value={landmarkArea}
                          onChange={(e) => setLandmarkArea(e.target.value)}
                          placeholder="e.g. Behind Metro Station"
                          className="w-full px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white transition-all"
                        />
                      </div>

                      {/* City (Compulsory) */}
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mb-1 block">CITY *</label>
                        <input
                          type="text"
                          required
                          value={addrCity}
                          onChange={(e) => setAddrCity(e.target.value)}
                          placeholder="e.g. Bengaluru"
                          className="w-full px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Select State (Compulsory Dropdown) */}
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mb-1 block">SELECT STATE *</label>
                        <select
                          required
                          value={addrState}
                          onChange={(e) => setAddrState(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white transition-all"
                        >
                          <option value="">-- Select State --</option>
                          {INDIAN_STATES.map(st => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                      </div>

                      {/* PIN Code (Compulsory 6 Digits) */}
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mb-1 block">PIN CODE (6 DIGITS) *</label>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={addrPincode}
                          onChange={(e) => setAddrPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="560103"
                          className="w-full px-3 py-2 text-xs font-mono font-medium border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white transition-all"
                        />
                      </div>
                    </div>

                    {/* Address Label Selector */}
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mb-1 block">ADD AN ADDRESS LABEL</label>
                        <div className="flex gap-1.5">
                          {['Home', 'Work', 'Other'].map(lbl => (
                            <button
                              key={lbl}
                              type="button"
                              onClick={() => setAddressLabel(lbl)}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                                addressLabel === lbl
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {lbl}
                            </button>
                          ))}
                        </div>
                        {addressLabel === 'Other' && (
                          <input
                            type="text"
                            required
                            value={customLabel}
                            onChange={(e) => setCustomLabel(e.target.value.slice(0, 15))}
                            placeholder="e.g. Gym, Friends"
                            className="w-full mt-2 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white transition-all"
                          />
                        )}
                      </div>

                    {/* Receiver details */}
                    <div className="border-t border-slate-200 pt-3 flex flex-col gap-2.5">
                      <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">RECEIVER DETAILS</span>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mb-1 block">NAME</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                              <User className="w-3.5 h-3.5" />
                            </span>
                            <input
                              type="text"
                              required
                              value={receiverName}
                              onChange={(e) => setReceiverName(e.target.value)}
                              placeholder="Receiver's name"
                              className="w-full pl-9 pr-3 py-2 text-xs font-medium border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white transition-all"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mb-1 block">MOBILE NUMBER</label>
                          <div className="relative flex items-center">
                            <span className="absolute left-3 text-slate-400">
                              <Phone className="w-3.5 h-3.5" />
                            </span>
                            <span className="absolute left-8 text-xs font-semibold text-slate-700 border-r border-slate-200 pr-1.5 h-4 flex items-center select-none">
                              +91
                            </span>
                            <input
                              type="tel"
                              required
                              minLength={10}
                              maxLength={10}
                              pattern="[0-9]{10}"
                              title="10-digit phone number"
                              value={receiverPhone}
                              onChange={(e) => setReceiverPhone(e.target.value.replace(/\D/g, '').slice(0,10))}
                              placeholder="10-digit phone"
                              className="w-full pl-16 pr-3 py-2 text-xs font-medium border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white transition-all"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                     {/* Save / Update Button */}
                     <div className="flex flex-col sm:flex-row gap-2 mt-2">
                       <button
                         type="submit"
                         disabled={isSavingAddress}
                         className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-semibold text-xs transition-all shadow-xs disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                       >
                         {isSavingAddress ? (
                           <>
                             <Loader2 className="w-4 h-4 animate-spin text-white" />
                             <span>{editingAddressId ? 'Updating Address...' : 'Saving to Profile...'}</span>
                           </>
                         ) : (
                           <>
                             <Save className="w-4 h-4 text-white" />
                             <span>{editingAddressId ? 'Update This Address' : 'Save This Address'}</span>
                           </>
                         )}
                       </button>

                       {editingAddressId && (
                         <button
                           type="button"
                           onClick={handleCancelEdit}
                           className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs transition-all flex items-center justify-center cursor-pointer shadow-xs"
                         >
                           Cancel
                         </button>
                       )}
                     </div>

                  </div>
               </form>

            </div>
          </div>
        </div>
      )}

      {/* 4. PROFILE UPDATE MODAL */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-fadeIn">
            
            {/* Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <UserCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm tracking-tight">Update Security Profile</h3>
              </div>
              <button
                onClick={() => setProfileModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Form */}
            <form onSubmit={handleUpdateProfile} className="p-6 flex flex-col gap-4">
              
              <p className="text-xs text-slate-500 font-normal leading-relaxed text-center border-b border-slate-100 pb-3">
                Updates are saved to your existing profile document.
              </p>

              {/* Email (Read Only) */}
              <div>
                <label className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mb-1 block">Registered Email (Read-Only)</label>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 select-none">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
                  <span className="text-xs font-medium text-slate-600 truncate">{currentUser.email}</span>
                </div>
              </div>

              {/* Full Legal Name */}
              <div>
                <label className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mb-1 block">Full Legal Name</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Your full legal name"
                    className="w-full pl-10 pr-4 py-2.5 text-xs font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white transition-all"
                  />
                </div>
              </div>

              {/* Mobile Phone */}
              <div>
                <label className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mb-1 block">Mobile Phone Number</label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-slate-400">
                    <Phone className="w-4 h-4" />
                  </span>
                  <span className="absolute left-9 text-xs font-semibold text-slate-700 border-r border-slate-200 pr-2 h-5 flex items-center select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    minLength={10}
                    maxLength={10}
                    pattern="[0-9]{10}"
                    title="10-digit mobile number"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile number"
                    className="w-full pl-20 pr-4 py-2.5 text-xs font-medium tracking-wider border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white transition-all"
                  />
                </div>
              </div>

              {/* Vehicle Registration Number */}
              <div>
                <label className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mb-1 flex items-center justify-between">
                  <span>Vehicle Registration Number</span>
                  <span className="font-mono text-[9px] text-slate-400">FORMAT: XX-00-AB-0000</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <ShieldCheck className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={profileLicense}
                    onChange={(e) => setProfileLicense(formatVehicleRegNumber(e.target.value))}
                    placeholder="e.g. KA-05-AB-1234"
                    maxLength={13}
                    className="w-full pl-10 pr-4 py-2.5 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white transition-all uppercase"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  💡 You can update your Vehicle Registration Number here in your profile section anytime after logging in.
                </p>
              </div>

              {/* Quick Address Search & Live GPS Auto-Detect Bar */}
              <div className="bg-emerald-50/90 p-3.5 border-2 border-emerald-600/30 rounded-xl flex flex-col gap-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Search Address / Area / Landmark</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleDetectProfileGPSLocation}
                    disabled={isLocatingProfile}
                    className="text-[10px] font-bold text-black bg-[#00E181] hover:bg-emerald-400 border border-black/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    {isLocatingProfile ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                    ) : (
                      <Navigation className="w-3.5 h-3.5 text-black" />
                    )}
                    <span>Detect GPS</span>
                  </button>
                </div>

                <div className="relative">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
                      {isSearchingProfile ? (
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                      ) : (
                        <Search className="w-4 h-4 text-neutral-500" />
                      )}
                    </span>
                    <input
                      type="text"
                      value={profileSearchQuery}
                      onChange={(e) => handleProfileAddressSearch(e.target.value)}
                      placeholder="Type building, street, locality e.g. Porur, Bellandur, Anna Nagar..."
                      className="w-full pl-9 pr-3.5 py-2 text-xs font-semibold border border-emerald-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00E181] bg-white text-neutral-900 shadow-xs"
                    />
                  </div>

                  {/* Search Dropdown Results */}
                  {profileSearchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border-2 border-black rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                      {profileSearchResults.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectProfileSearchResult(item)}
                          className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-neutral-800 hover:bg-emerald-100 border-b border-neutral-100 last:border-b-0 transition-all flex items-start gap-2 cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{item.display_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-emerald-800 font-medium">
                  💡 Select a location or enter PIN code to auto-detect city & state!
                </p>
              </div>

              {/* Street Address */}
              <div>
                <label className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mb-1 block">Street / House / Flat Address *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-slate-400">
                    <MapPin className="w-4 h-4" />
                  </span>
                  <textarea
                    required
                    rows={2}
                    value={profileAddress}
                    onChange={(e) => setProfileAddress(e.target.value)}
                    placeholder="Primary coordinate address..."
                    className="w-full pl-10 pr-4 py-2.5 text-xs font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white transition-all resize-none leading-relaxed"
                  />
                </div>
              </div>

              {/* City + PIN Code Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mb-1 block">City *</label>
                  <input
                    type="text"
                    required
                    value={profileCity}
                    onChange={(e) => setProfileCity(e.target.value)}
                    placeholder="e.g. Bengaluru"
                    className="w-full px-3.5 py-2.5 text-xs font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white transition-all"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase block">
                      PIN Code (6 Digits) *
                    </label>
                    {isPincodeLoading && (
                      <span className="text-[9px] font-bold text-emerald-700 flex items-center gap-1 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin text-emerald-700" />
                        Detecting...
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={profilePincode}
                    onChange={(e) => handleProfilePincodeChange(e.target.value)}
                    placeholder="560103"
                    className="w-full px-3.5 py-2.5 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white transition-all"
                  />
                </div>
              </div>

              {/* State Dropdown */}
              <div>
                <label className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mb-1 block">Select State *</label>
                <select
                  required
                  value={profileState}
                  onChange={(e) => setProfileState(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white transition-all"
                >
                  <option value="">-- Select State --</option>
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 mt-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-semibold text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-semibold text-xs disabled:opacity-60 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  {isUpdatingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Updating Profile...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 text-white" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 5. MANDATORY ONBOARDING & PRIMARY ADDRESS MODAL */}
      {mandatoryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white border-2 border-black rounded-2xl shadow-[8px_8px_0px_rgba(0,0,0,1)] overflow-hidden my-6 animate-fadeIn">
            
            {/* Header Banner */}
            <div className="bg-[#00E181] border-b-2 border-black px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3 text-black">
                <div className="w-9 h-9 rounded-xl bg-black text-[#00E181] flex items-center justify-center font-black border border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-black text-white px-2 py-0.5 rounded">
                    MANDATORY TRANSPARENCY STEP
                  </span>
                  <h3 className="font-black text-base text-black tracking-tight mt-0.5">
                    Update Primary Delivery Address & Details
                  </h3>
                </div>
              </div>
              {currentUser.address && currentUser.address.trim().length > 0 && (
                <button
                  onClick={() => setMandatoryModalOpen(false)}
                  className="w-8 h-8 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-black flex items-center justify-center transition-all cursor-pointer shadow-[2px_2px_0px_rgba(0,0,0,1)]"
                >
                  <X className="w-4 h-4 stroke-[3]" />
                </button>
              )}
            </div>

            {/* Explanation Note */}
            <div className="p-6 flex flex-col gap-4">
              <div className="p-3.5 bg-amber-50 border-2 border-black rounded-xl text-xs text-neutral-900 font-bold flex items-start gap-2.5 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span className="font-black uppercase text-[10px] text-amber-800 tracking-wider">Logistics Ratio & Transparency Notice</span>
                  <span className="leading-relaxed">
                    To maintain operational transparency, maximize courier efficiency, and ensure optimal delivery ratios, it is mandatory to confirm your <strong>Primary Address</strong> and <strong>Phone Number</strong>. This primary address will be set as your default delivery location.
                  </span>
                </div>
              </div>

              <form onSubmit={handleSaveMandatoryProfile} className="flex flex-col gap-4">
                
                {/* Full Legal Name */}
                <div>
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider mb-1 block">
                    FULL LEGAL NAME *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={mandatoryName}
                      onChange={(e) => setMandatoryName(e.target.value)}
                      placeholder="e.g. Kartik Gowda"
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs font-black border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00E181] bg-white transition-all text-neutral-900"
                    />
                  </div>
                </div>

                {/* Mobile Phone Number */}
                <div>
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider mb-1 block">
                    10-DIGIT MOBILE PHONE NUMBER *
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
                      required
                      minLength={10}
                      maxLength={10}
                      pattern="[0-9]{10}"
                      title="10-digit mobile number"
                      value={mandatoryPhone}
                      onChange={(e) => setMandatoryPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9876543210"
                      className="w-full pl-20 pr-3.5 py-2.5 text-xs font-black border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00E181] bg-white transition-all text-neutral-900"
                    />
                  </div>
                </div>

                {/* Quick Address Search & Live GPS Auto-Detect Bar for Sign Up */}
                <div className="bg-emerald-50/80 p-3.5 border-2 border-black rounded-xl flex flex-col gap-2.5 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-emerald-950 uppercase tracking-wider block">
                      🔍 QUICK ADDRESS SEARCH / GPS DETECT
                    </label>
                    <button
                      type="button"
                      onClick={handleDetectMandatoryGPSLocation}
                      disabled={isLocatingMandatory}
                      className="text-[10px] font-black text-black bg-[#00E181] hover:bg-emerald-400 border-2 border-black px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-[1px_1px_0px_rgba(0,0,0,1)] active:translate-y-[1px]"
                    >
                      {isLocatingMandatory ? (
                        <Loader2 className="w-3 h-3 animate-spin text-black" />
                      ) : (
                        <Navigation className="w-3 h-3 text-black" />
                      )}
                      <span>Use Device GPS</span>
                    </button>
                  </div>

                  <div className="relative">
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500">
                        {isSearchingMandatory ? <Loader2 className="w-4 h-4 animate-spin text-emerald-700" /> : <Search className="w-4 h-4 text-neutral-600" />}
                      </span>
                      <input
                        type="text"
                        value={mandatorySearchQuery}
                        onChange={(e) => handleMandatoryAddressSearch(e.target.value)}
                        placeholder="Search building, street, locality e.g. Porur, Bellandur, Anna Nagar..."
                        className="w-full pl-10 pr-3.5 py-2 text-xs font-bold border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00E181] bg-white text-neutral-900"
                      />
                    </div>

                    {/* Search Dropdown Results */}
                    {mandatorySearchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border-2 border-black rounded-xl shadow-[3px_3px_0px_rgba(0,0,0,1)] overflow-hidden max-h-48 overflow-y-auto">
                        {mandatorySearchResults.map((item, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectMandatorySearchResult(item)}
                            className="w-full text-left px-3.5 py-2 text-xs font-bold text-neutral-800 hover:bg-emerald-100 border-b-2 border-neutral-100 last:border-b-0 transition-all flex items-start gap-2 cursor-pointer"
                          >
                            <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{item.display_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary Address Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">
                      STREET / HOUSE / FLAT ADDRESS *
                    </label>
                    <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded">
                      DEFAULT DESTINATION
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-neutral-400">
                      <Home className="w-4 h-4" />
                    </span>
                    <textarea
                      required
                      rows={2}
                      value={mandatoryAddress}
                      onChange={(e) => setMandatoryAddress(e.target.value)}
                      placeholder="Enter flat/house no, street, landmark, and area (e.g. Apt 302, Green Glen Layout, Bellandur)"
                      className="w-full pl-10 pr-3.5 py-2 text-xs font-bold border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00E181] bg-white transition-all text-neutral-900 leading-relaxed resize-none"
                    />
                  </div>
                </div>

                {/* City + PIN Code Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider mb-1 block">
                      CITY *
                    </label>
                    <input
                      type="text"
                      required
                      value={mandatoryCity}
                      onChange={(e) => setMandatoryCity(e.target.value)}
                      placeholder="e.g. Bengaluru"
                      className="w-full px-3.5 py-2 text-xs font-bold border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00E181] bg-white transition-all text-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider mb-1 block">
                      PIN CODE (6 DIGITS) *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={mandatoryPincode}
                      onChange={(e) => handleMandatoryPincodeChange(e.target.value)}
                      placeholder="560103"
                      className="w-full px-3.5 py-2 text-xs font-mono font-bold border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00E181] bg-white transition-all text-neutral-900"
                    />
                  </div>
                </div>

                {/* State Dropdown Select */}
                <div>
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider mb-1 block">
                    SELECT STATE *
                  </label>
                  <select
                    required
                    value={mandatoryState}
                    onChange={(e) => setMandatoryState(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-bold border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00E181] bg-white transition-all text-neutral-900"
                  >
                    <option value="">-- Select State --</option>
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Action Button */}
                <button
                  type="submit"
                  disabled={isSavingMandatory}
                  className="w-full py-3 bg-[#00E181] hover:bg-emerald-400 text-black border-2 border-black rounded-xl font-black text-xs uppercase tracking-wider shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] active:translate-y-[1px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 mt-1"
                >
                  {isSavingMandatory ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      <span>Saving Primary Address...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 text-black" />
                      <span>Confirm & Set as Default Delivery Location</span>
                    </>
                  )}
                </button>

              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
