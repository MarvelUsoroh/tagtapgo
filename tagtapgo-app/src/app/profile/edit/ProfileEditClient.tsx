'use client';

import { useState, useRef, ChangeEvent, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useToast } from '@/context/ToastContext';
import { getCroppedImg } from '@/lib/cropImage';
import { IoArrowBack, IoCamera, IoSave, IoPerson, IoCheckmark, IoClose } from 'react-icons/io5';

interface Student {
  id: string;
  name: string;
  avatar_url: string | null;
  email: string | null;
}

interface ProfileEditClientProps {
  student: Student;
}

export default function ProfileEditClient({ student }: ProfileEditClientProps) {
  const router = useRouter();
  const { success, error: showError } = useToast();
  
  const [loading, setLoading] = useState(false);

  // Cropping state
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null); // src fed into <Cropper>
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // Final preview state (after crop applied)
  const [previewUrl, setPreviewUrl] = useState<string | null>(student.avatar_url);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Called when user selects a file → open the crop modal
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showError('Please select an image file');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      showError('Image must be less than 5MB');
      return;
    }

    // Load the file as a data URL, then show the crop UI
    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result as string);
      // Reset crop state for the new image
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);

    // Important: reset the input so the same file can be re-selected
    e.target.value = '';
  };

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  // User confirmed the crop → generate the cropped blob and preview
  const handleApplyCrop = async () => {
    if (!rawImageSrc || !croppedAreaPixels) return;
    try {
      const blob = await getCroppedImg(rawImageSrc, croppedAreaPixels);
      const localUrl = URL.createObjectURL(blob);
      setPreviewUrl(localUrl);
      setCroppedBlob(blob);
      setRawImageSrc(null); // close modal
    } catch {
      showError('Failed to process the image. Please try again.');
    }
  };

  const handleCancelCrop = () => {
    setRawImageSrc(null);
  };

  const handleSave = async () => {
    if (!croppedBlob) {
      router.back();
      return;
    }

    setLoading(true);

    try {
      // 1. Get current authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 2. Upload the cropped JPEG blob to Supabase Storage
      const filePath = `${user.id}/avatar.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedBlob, {
          contentType: 'image/jpeg',
          cacheControl: '1',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 3. Get the public URL with a cache-busting query param
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
        
      const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;

      // 4. Update the students table
      const { error: updateError } = await supabase
        .from('students')
        .update({ avatar_url: urlWithCacheBuster })
        .eq('id', user.id);

      if (updateError) throw updateError;

      success('Profile picture updated successfully');
      router.push('/settings');
      router.refresh();
    } catch (error) {
      console.error('Error updating profile picture:', error);
      showError('Failed to update profile picture. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* ── Crop Modal Overlay ── */}
      {rawImageSrc && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          {/* Crop Modal Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm">
            <button
              onClick={handleCancelCrop}
              className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors text-sm font-medium"
            >
              <IoClose className="w-5 h-5" />
              Cancel
            </button>
            <span className="text-white font-semibold text-sm">Adjust Photo</span>
            <button
              onClick={handleApplyCrop}
              className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full transition-colors"
              style={{ backgroundColor: colors.primary.DEFAULT, color: '#fff' }}
            >
              <IoCheckmark className="w-4 h-4" />
              Apply
            </button>
          </div>

          {/* Cropper Canvas */}
          <div className="relative flex-1">
            <Cropper
              image={rawImageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              style={{
                containerStyle: { background: '#111' },
                cropAreaStyle: {
                  border: `3px solid ${colors.primary.DEFAULT}`,
                  boxShadow: `0 0 0 9999px rgba(0,0,0,0.65)`,
                },
              }}
            />
          </div>

          {/* Zoom Slider */}
          <div className="px-6 py-4 bg-black/80 backdrop-blur-sm flex items-center gap-4">
            <span className="text-white/50 text-xs">–</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-green-500 h-1"
            />
            <span className="text-white/50 text-xs">+</span>
          </div>
        </div>
      )}

      {/* ── Main Page ── */}
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/settings')}
              disabled={loading}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
            >
              <IoArrowBack className="w-6 h-6 text-gray-700" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">Edit Profile</h1>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto px-4 py-6 pb-32">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-6 max-w-md mx-auto relative">
            
            <h2 className="text-lg font-bold text-gray-900 mb-6 text-center">Profile Picture</h2>
            
            {/* Avatar Edit Section */}
            <div className="flex flex-col items-center justify-center gap-6">
              
              {/* The Avatar Preview */}
              <div className="relative group">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-gray-50 shadow-sm relative bg-gray-100 flex items-center justify-center">
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={previewUrl} 
                      alt="Profile Preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <IoPerson className="w-16 h-16 text-gray-400" />
                  )}
                  
                  {/* Overlay for hover */}
                  <div 
                    className={cn(
                      "absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 transition-opacity cursor-pointer",
                      !loading && "group-hover:opacity-100"
                    )}
                    onClick={() => !loading && fileInputRef.current?.click()}
                  >
                    <IoCamera className="w-8 h-8 text-white" />
                  </div>
                </div>
                
                {/* Badge Button */}
                <button
                  type="button"
                  onClick={() => !loading && fileInputRef.current?.click()}
                  disabled={loading}
                  className="absolute bottom-0 right-0 p-2.5 rounded-full text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                  style={{ backgroundColor: colors.primary.DEFAULT }}
                >
                  <IoCamera className="w-5 h-5" />
                </button>
              </div>
              
              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/jpeg, image/png, image/webp"
                className="hidden"
              />
              
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">{student.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {croppedBlob ? 'Crop applied ✓  Tap to change' : 'Tap the camera icon to select an image'}
                </p>
              </div>
            </div>
            
            {/* Read Only Fields Notice */}
            <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Linked Information</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-gray-500 block">Name</span>
                  <span className="text-sm font-medium text-gray-900">{student.name}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">University Email</span>
                  <span className="text-sm font-medium text-gray-900">{student.email}</span>
                </div>
                <p className="text-xs text-gray-400 italic mt-2 border-t border-gray-200 pt-2">
                  This core information is synchronized securely from your Moodle profile and cannot be edited.
                </p>
              </div>
            </div>
            
          </div>
        </div>
        
        {/* Sticky Bottom Save Bar */}
        <div className="bg-white border-t border-gray-100 p-4 pb-24 sm:pb-8 sticky bottom-0 z-10 w-full max-w-md mx-auto shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button
            onClick={handleSave}
            disabled={loading || !croppedBlob}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-white font-medium transition-all shadow-sm",
              (loading || !croppedBlob) ? "opacity-50 cursor-not-allowed" : "hover:-translate-y-0.5 hover:shadow"
            )}
            style={{ backgroundColor: colors.primary.DEFAULT }}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <IoSave className="w-5 h-5" />
                <span>{croppedBlob ? 'Save Profile Picture' : 'Select an Image First'}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </>
  );
}
