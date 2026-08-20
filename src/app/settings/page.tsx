"use client";

import React, { useState, useEffect } from "react";
import { 
  Home, ChevronRight, User, Shield, Settings as SettingsIcon, 
  Edit3, Eye, EyeOff, ChevronDown, Lock, AlertTriangle, Upload, CheckCircle2, Loader2,
  Store, Globe, Bell, DollarSign, Clock, ShieldAlert, Sparkles, Sliders
} from "lucide-react";
import { settingsApi } from "@/lib/api";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'app'>('profile');
  
  // Profile State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  
  // Security State
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  // App Settings State
  const [storeName, setStoreName] = useState("VASTRAX Luxury Apparel");
  const [supportEmail, setSupportEmail] = useState("concierge@vastrax.luxury");
  const [supportPhone, setSupportPhone] = useState("+1 (800) 827-8729");
  const [currency, setCurrency] = useState("USD ($)");
  const [timezone, setTimezone] = useState("UTC-05:00 (Eastern Time)");
  const [announcementText, setAnnouncementText] = useState("Complimentary Global Express Delivery on Orders Over $250");
  const [enableGuestCheckout, setEnableGuestCheckout] = useState(true);
  const [enableLowStockAlerts, setEnableLowStockAlerts] = useState(true);
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [autoArchiveOrders, setAutoArchiveOrders] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [stylistSystemPrompt, setStylistSystemPrompt] = useState(
    "You are Vastra, the premier personal style advisor for VastraX Haute Couture boutique.\n" +
    "Tone: Sophisticated, welcoming, and concise (2-3 sentences per reply). Always ask ONE clear question at a time.\n" +
    "Guidance: Match silhouettes and colors based on customer skin tone, height, and occasion.\n" +
    "Sales & Offers: Mention our active promotions naturally when recommending outfits.\n" +
    "Encourage customers to click 'Try On' to preview outfits in the AI Fitting Room."
  );
  const [activeOffers, setActiveOffers] = useState(
    "Use code VASTRA10 for 10% off your first luxury order; Complimentary express shipping on orders over ₹2,500."
  );
  const [isSavingAppSettings, setIsSavingAppSettings] = useState(false);
  const [appSettingsSaved, setAppSettingsSaved] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      const data = await settingsApi.getApp();
      if (data) {
        if (data.storeName) setStoreName(data.storeName);
        if (data.supportEmail) setSupportEmail(data.supportEmail);
        if (data.supportPhone) setSupportPhone(data.supportPhone);
        if (data.currency) setCurrency(data.currency);
        if (data.timezone) setTimezone(data.timezone);
        if (data.announcementText) setAnnouncementText(data.announcementText);
        if (data.enableGuestCheckout !== undefined) setEnableGuestCheckout(data.enableGuestCheckout);
        if (data.enableLowStockAlerts !== undefined) setEnableLowStockAlerts(data.enableLowStockAlerts);
        if (data.lowStockThreshold !== undefined) setLowStockThreshold(String(data.lowStockThreshold));
        if (data.autoArchiveOrders !== undefined) setAutoArchiveOrders(data.autoArchiveOrders);
        if (data.maintenanceMode !== undefined) setMaintenanceMode(data.maintenanceMode);
        if (data.stylistSystemPrompt) setStylistSystemPrompt(data.stylistSystemPrompt);
        if (data.activeOffers) setActiveOffers(data.activeOffers);
      }
    }
    loadSettings();
  }, []);

  const handleSaveAppSettings = async () => {
    setIsSavingAppSettings(true);
    await settingsApi.updateApp({
      storeName,
      supportEmail,
      supportPhone,
      currency,
      timezone,
      announcementText,
      enableGuestCheckout,
      enableLowStockAlerts,
      lowStockThreshold: Number(lowStockThreshold),
      autoArchiveOrders,
      maintenanceMode,
      stylistSystemPrompt,
      activeOffers
    });
    setIsSavingAppSettings(false);
    setAppSettingsSaved(true);
    setTimeout(() => setAppSettingsSaved(false), 3000);
  };

  const handleSaveProfile = () => {
    setIsSavingProfile(true);
    setTimeout(() => {
      setIsSavingProfile(false);
      setIsEditingProfile(false);
    }, 1000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChangePassword = () => {
    setIsChangingPassword(true);
    setTimeout(() => {
      setIsChangingPassword(false);
      setPasswordChanged(true);
      setTimeout(() => setPasswordChanged(false), 3000);
    }, 1500);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Home className="w-3 h-3" />
        <ChevronRight className="w-3 h-3" />
        <span className="cursor-pointer hover:text-foreground transition-colors">Dashboard</span>
        <ChevronRight className="w-3 h-3" />
        <span className="cursor-pointer hover:text-foreground transition-colors">Settings</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground capitalize">{activeTab}</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">Manage your account settings and preferences</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 mt-6">
        {/* Left Navigation */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="bg-surface border border-border rounded-xl p-2 space-y-1">
            <button 
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'profile' 
                  ? 'bg-accent/10 text-accent relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-accent before:rounded-r' 
                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
              }`}
            >
              <User className="w-4 h-4" />
              Profile
            </button>
            <button 
              onClick={() => setActiveTab('security')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'security' 
                  ? 'bg-accent/10 text-accent relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-accent before:rounded-r' 
                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
              }`}
            >
              <Shield className="w-4 h-4" />
              Security
            </button>
            <button 
              onClick={() => setActiveTab('app')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'app' 
                  ? 'bg-accent/10 text-accent relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-accent before:rounded-r' 
                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              App Settings
            </button>
          </div>
        </div>

        {/* Right Content */}
        <div className="flex-1">
          <div className="bg-surface border border-border rounded-xl p-6 md:p-8">
            {activeTab === 'profile' && (
              <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
                {/* Profile Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center text-muted-foreground border border-border overflow-hidden">
                      {profileImage ? (
                        <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-6 h-6" />
                      )}
                    </div>
                    {isEditingProfile ? (
                      <div className="relative">
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleImageUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                          title="Choose Image"
                        />
                        <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-border hover:bg-surface-hover text-sm font-medium transition-colors pointer-events-none">
                          <Upload className="w-4 h-4" />
                          Choose Image
                        </button>
                      </div>
                    ) : (
                      <div>
                        <h2 className="text-xl font-bold text-foreground">Demo Tester</h2>
                        <p className="text-sm text-muted-foreground mt-0.5">demo+vjkjzs5v@example.com</p>
                      </div>
                    )}
                  </div>
                  
                  {isEditingProfile ? (
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setIsEditingProfile(false)}
                        className="px-6 py-2 rounded-full border border-border hover:bg-surface-hover text-sm font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleSaveProfile}
                        disabled={isSavingProfile}
                        className="flex items-center justify-center min-w-[120px] px-6 py-2 bg-accent hover:bg-accent/90 text-white font-medium text-sm rounded-full transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)] disabled:opacity-70"
                      >
                        {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setIsEditingProfile(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-surface-hover hover:bg-border/50 text-sm font-medium transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit Profile
                    </button>
                  )}
                </div>

                {/* Profile Form */}
                <div className="space-y-6 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">First Name</label>
                      <input 
                        type="text" 
                        defaultValue="Demo"
                        readOnly={!isEditingProfile}
                        className={`w-full px-4 py-2.5 rounded-lg text-sm transition-all focus:outline-none ${isEditingProfile ? 'bg-background border border-border focus:ring-1 focus:ring-accent text-foreground' : 'bg-background/50 border border-border/50 text-muted-foreground'}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Last Name</label>
                      <input 
                        type="text" 
                        defaultValue="Tester"
                        readOnly={!isEditingProfile}
                        className={`w-full px-4 py-2.5 rounded-lg text-sm transition-all focus:outline-none ${isEditingProfile ? 'bg-background border border-border focus:ring-1 focus:ring-accent text-foreground' : 'bg-background/50 border border-border/50 text-muted-foreground'}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Email Address</label>
                      <input 
                        type="email" 
                        defaultValue="demo+vjkjzs5v@example.com"
                        readOnly
                        className="w-full px-4 py-2.5 bg-background/50 border border-border/50 rounded-lg text-sm text-muted-foreground/70 cursor-not-allowed focus:outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Phone Number</label>
                      <div className={`flex rounded-lg transition-all overflow-hidden ${isEditingProfile ? 'bg-background border border-border focus-within:ring-1 focus-within:ring-accent' : 'bg-background/50 border border-border/50'}`}>
                        <button disabled={!isEditingProfile} className={`flex items-center gap-1.5 px-3 border-r transition-colors ${isEditingProfile ? 'border-border bg-surface-hover hover:bg-border/50' : 'border-border/50 bg-transparent opacity-70'}`}>
                          <span className="text-lg">🇺🇸</span>
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <input 
                          type="tel" 
                          placeholder="Enter your phone number"
                          readOnly={!isEditingProfile}
                          className={`w-full px-4 py-2.5 bg-transparent text-sm focus:outline-none ${isEditingProfile ? 'text-foreground placeholder:text-muted-foreground' : 'text-muted-foreground'}`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Country</label>
                    <div className="relative">
                      <select 
                        defaultValue=""
                        disabled={!isEditingProfile}
                        className={`w-full px-4 py-2.5 rounded-lg text-sm transition-all appearance-none focus:outline-none ${isEditingProfile ? 'bg-background border border-border focus:ring-1 focus:ring-accent text-foreground cursor-pointer' : 'bg-background/50 border border-border/50 text-muted-foreground cursor-not-allowed'}`}
                      >
                        <option value="" disabled>No country selected</option>
                        <option value="us">United States</option>
                        <option value="uk">United Kingdom</option>
                        <option value="ca">Canada</option>
                      </select>
                      <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isEditingProfile ? 'text-muted-foreground' : 'text-muted-foreground/50'}`} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
                {/* Security Header */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center text-accent border border-accent/20">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Change Password</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Update your password to keep your account secure</p>
                  </div>
                </div>

                {/* Security Form */}
                <div className="space-y-6 pt-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Current Password</label>
                    <div className="relative">
                      <input 
                        type={showCurrentPassword ? "text" : "password"}
                        placeholder="Enter your current password"
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent transition-all text-foreground placeholder:text-muted-foreground pr-12"
                      />
                      <button 
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">New Password</label>
                      <div className="relative">
                        <input 
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Enter your new password"
                          className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent transition-all text-foreground placeholder:text-muted-foreground pr-12"
                        />
                        <button 
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Confirm New Password</label>
                      <div className="relative">
                        <input 
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm your new password"
                          className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent transition-all text-foreground placeholder:text-muted-foreground pr-12"
                        />
                        <button 
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Security Notice */}
                  <div className="mt-6 bg-background border border-border rounded-lg p-4 flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-foreground">Security Notice</h4>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        After changing your password, you'll remain logged in on this device. However, you'll need to sign in again on other devices.
                      </p>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-4 flex items-center justify-end gap-4">
                    {passwordChanged && (
                      <span className="flex items-center gap-2 text-sm text-green-500 animate-in fade-in zoom-in duration-300">
                        <CheckCircle2 className="w-4 h-4" />
                        Password updated securely
                      </span>
                    )}
                    <button 
                      onClick={handleChangePassword}
                      disabled={isChangingPassword}
                      className="flex items-center justify-center min-w-[160px] px-6 py-2.5 bg-accent hover:bg-accent/90 text-white font-medium text-sm rounded-full transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)] disabled:opacity-70"
                    >
                      {isChangingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Change Password'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'app' && (
              <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between pb-6 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-foreground">App & Storefront Configuration</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">Control global store parameters, checkout behavior, and storefront rules</p>
                    </div>
                  </div>
                </div>

                {/* Section 1: Store Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <Globe className="w-4 h-4 text-accent" /> General Store Info
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Store Display Name</label>
                      <input 
                        type="text" 
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent transition-all text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Concierge Support Email</label>
                      <input 
                        type="email" 
                        value={supportEmail}
                        onChange={(e) => setSupportEmail(e.target.value)}
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent transition-all text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Support Hotline</label>
                      <input 
                        type="text" 
                        value={supportPhone}
                        onChange={(e) => setSupportPhone(e.target.value)}
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent transition-all text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Primary Operating Currency</label>
                      <div className="relative">
                        <select 
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value)}
                          className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent transition-all text-foreground appearance-none pr-10"
                        >
                          <option value="USD ($)">USD ($) - US Dollar</option>
                          <option value="EUR (€)">EUR (€) - Euro</option>
                          <option value="GBP (£)">GBP (£) - British Pound</option>
                          <option value="SAR (﷼)">SAR (﷼) - Saudi Riyal</option>
                          <option value="AED (د.إ)">AED (د.إ) - UAE Dirham</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Storefront Banner & Announcement */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-accent" /> Storefront Announcement Marquee
                  </h3>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Header Announcement Text</label>
                    <input 
                      type="text" 
                      value={announcementText}
                      onChange={(e) => setAnnouncementText(e.target.value)}
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent transition-all text-foreground"
                    />
                    <p className="text-[11px] text-muted-foreground">Displays at the top banner across all storefront pages.</p>
                  </div>
                </div>

                {/* Section 3: Checkout & Inventory Rules */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-accent" /> Checkout & Inventory Rules
                  </h3>
                  <div className="space-y-3">
                    {/* Toggle 1: Guest Checkout */}
                    <div className="flex items-center justify-between p-4 bg-background rounded-xl border border-border">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-foreground">Allow Express Guest Checkout</p>
                        <p className="text-xs text-muted-foreground">Customers can complete purchases without pre-registering an account</p>
                      </div>
                      <button 
                        onClick={() => setEnableGuestCheckout(!enableGuestCheckout)}
                        className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-1 ${
                          enableGuestCheckout ? 'bg-accent' : 'bg-muted-foreground/30'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          enableGuestCheckout ? 'translate-x-6' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    {/* Toggle 2: Low Stock Notifications */}
                    <div className="flex items-center justify-between p-4 bg-background rounded-xl border border-border">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-foreground">Low Stock Critical Alerts</p>
                        <p className="text-xs text-muted-foreground">Flag products on the dashboard when inventory falls below threshold</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Threshold:</span>
                          <input 
                            type="number" 
                            value={lowStockThreshold}
                            onChange={(e) => setLowStockThreshold(e.target.value)}
                            className="w-16 px-2 py-1 bg-surface border border-border rounded text-xs text-center text-foreground focus:outline-none focus:border-accent"
                          />
                        </div>
                        <button 
                          onClick={() => setEnableLowStockAlerts(!enableLowStockAlerts)}
                          className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-1 ${
                            enableLowStockAlerts ? 'bg-accent' : 'bg-muted-foreground/30'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                            enableLowStockAlerts ? 'translate-x-6' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>
                    </div>

                    {/* Toggle 3: Auto Archive Fulfilled Orders */}
                    <div className="flex items-center justify-between p-4 bg-background rounded-xl border border-border">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-foreground">Auto-Archive Fulfilled Orders</p>
                        <p className="text-xs text-muted-foreground">Move orders to archived state 30 days after marked delivered</p>
                      </div>
                      <button 
                        onClick={() => setAutoArchiveOrders(!autoArchiveOrders)}
                        className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-1 ${
                          autoArchiveOrders ? 'bg-accent' : 'bg-muted-foreground/30'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          autoArchiveOrders ? 'translate-x-6' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section 4: AI Stylist & Concierge Intelligence */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-accent" /> AI Stylist & Concierge (GPT-4o mini)
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setStylistSystemPrompt(
                          "You are Vastra, the premier personal style advisor for VastraX Haute Couture boutique.\n" +
                          "Tone: Sophisticated, welcoming, and concise (2-3 sentences per reply). Always ask ONE clear question at a time.\n" +
                          "Guidance: Match silhouettes and colors based on customer skin tone, height, and occasion.\n" +
                          "Sales & Offers: Mention our active promotions naturally when recommending outfits.\n" +
                          "Encourage customers to click 'Try On' to preview outfits in the AI Fitting Room."
                        );
                        setActiveOffers("Use code VASTRA10 for 10% off your first luxury order; Complimentary express shipping on orders over ₹2,500.");
                      }}
                      className="text-xs text-accent hover:underline cursor-pointer"
                    >
                      Reset to Default Prompt
                    </button>
                  </div>

                  <div className="space-y-4 bg-background/50 p-4 rounded-xl border border-border">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground flex items-center justify-between">
                        <span>Active Boutique Promotions & Offers</span>
                        <span className="text-[11px] text-muted-foreground">Injected directly into chat context</span>
                      </label>
                      <input 
                        type="text" 
                        value={activeOffers}
                        onChange={(e) => setActiveOffers(e.target.value)}
                        placeholder="e.g. Use code VASTRA10 for 10% off; Free express shipping on orders over ₹2,500"
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent transition-all text-foreground"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground flex items-center justify-between">
                        <span>Stylist Persona & System Instructions</span>
                        <span className="text-[11px] text-muted-foreground">Guides how AI talks to customers</span>
                      </label>
                      <textarea 
                        rows={5}
                        value={stylistSystemPrompt}
                        onChange={(e) => setStylistSystemPrompt(e.target.value)}
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent transition-all text-foreground font-mono text-xs leading-relaxed resize-y"
                        placeholder="Enter system prompt instructions for the AI stylist..."
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Live products from your database and catalog stock are automatically attached to this prompt in real time.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 5: Maintenance Mode */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-500" /> Maintenance & VIP Lock
                  </h3>
                  <div className="flex items-center justify-between p-4 bg-background rounded-xl border border-border">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-foreground">Enable Storefront Maintenance Mode</p>
                      <p className="text-xs text-muted-foreground">Only authorized admins can preview the storefront; visitors see private landing</p>
                    </div>
                    <button 
                      onClick={() => setMaintenanceMode(!maintenanceMode)}
                      className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-1 ${
                        maintenanceMode ? 'bg-amber-500' : 'bg-muted-foreground/30'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        maintenanceMode ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                </div>

                {/* Save Action */}
                <div className="pt-4 flex items-center justify-end gap-4 border-t border-border">
                  {appSettingsSaved && (
                    <span className="flex items-center gap-2 text-sm text-green-500 animate-in fade-in zoom-in duration-300">
                      <CheckCircle2 className="w-4 h-4" />
                      App preferences updated successfully
                    </span>
                  )}
                  <button 
                    onClick={handleSaveAppSettings}
                    disabled={isSavingAppSettings}
                    className="flex items-center justify-center min-w-[160px] px-6 py-2.5 bg-accent hover:bg-accent/90 text-white font-medium text-sm rounded-full transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)] disabled:opacity-70"
                  >
                    {isSavingAppSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save App Settings'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
