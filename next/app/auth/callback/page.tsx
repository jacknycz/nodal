'use client';

import { useEffect } from 'react';
import { supabase } from '../../../src/features/auth/supabaseClient';

export default function AuthCallbackPage() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      console.log('[Callback] Supabase session after redirect:', data.session);
    });
    setTimeout(() => {
      const redirectUrl = sessionStorage.getItem('authRedirectUrl');
      sessionStorage.removeItem('authRedirectUrl');
      if (redirectUrl && !redirectUrl.includes('/auth/callback')) {
        window.location.replace(redirectUrl);
      } else {
        window.location.replace('/');
      }
    }, 500);
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center">
      <span>Processing login...</span>
    </div>
  );
} 