'use client';

import { useEffect } from 'react';
import { supabase } from '../../../src/features/auth/supabaseClient';

export default function AuthCallbackPage() {
  useEffect(() => {
    // Log the session immediately after redirect
    supabase.auth.getSession().then(({ data }) => {
      console.log('[Callback] Supabase session after redirect:', data.session);
    });
    setTimeout(() => {
      window.location.replace('/');
    }, 500);
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center">
      <span>Processing login...</span>
    </div>
  );
} 