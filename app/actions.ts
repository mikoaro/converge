// app/actions.ts
'use server';

import { createClient } from '@supabase/supabase-js';

export async function submitVote(sessionId: string, businessId: string, userId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY|| 'placeholder'
  );

  // 1. Check if user already voted for this business
  const { data: existing } = await supabase
    .from('votes')
    .select('id')
    .match({ session_id: sessionId, business_id: businessId, user_id: userId })
    .single();

  if (existing) {
    // Optional: Toggle vote off if already voted (Remove this block if you want append-only)
    await supabase.from('votes').delete().eq('id', existing.id);
    return { success: true, action: 'removed' };
  }

  // 2. Insert new vote
  const { error } = await supabase.from('votes').insert({
    session_id: sessionId,
    business_id: businessId,
    user_id: userId,
    value: 1
  });

  if (error) {
    console.error("Vote failed:", error);
    return { success: false, error: error.message };
  }
  
  return { success: true, action: 'added' };
}