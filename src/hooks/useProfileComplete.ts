import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useProfileComplete = () => {
  const { user, loading: authLoading } = useAuth();
  const [isProfileComplete, setIsProfileComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkProfile = async () => {
      if (!user) {
        setIsProfileComplete(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('profile_completed')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error checking profile:', error);
          setIsProfileComplete(true); // Assume complete on error to not block user
        } else {
          setIsProfileComplete(data?.profile_completed ?? false);
        }
      } catch (err) {
        console.error('Profile check error:', err);
        setIsProfileComplete(true);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      checkProfile();
    }
  }, [user, authLoading]);

  return { isProfileComplete, loading: loading || authLoading, user };
};
