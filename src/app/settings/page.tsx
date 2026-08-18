"use client";

import React, { useState } from "react";
import { 
  Home, ChevronRight, User, Shield, Settings as SettingsIcon, 
  Edit3, Eye, EyeOff, ChevronDown, Lock, AlertTriangle, Upload, CheckCircle2, Loader2 
} from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  
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
              disabled
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground/50 cursor-not-allowed"
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
          </div>
        </div>
      </div>
    </div>
  );
}
