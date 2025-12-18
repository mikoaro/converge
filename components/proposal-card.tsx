// apps/web/components/proposal-card.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Loader2, Users } from "lucide-react";
import Image from 'next/image';
import { submitVote } from '@/app/actions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Business {
  id: string;
  name: string;
  rating: number;
  review_count: number;
  image_url: string;
  price?: string;
  categories?: { title: string }[];
  review_snippet?: string;
  _sessionId?: string;
}

interface ProposalCardProps {
  businesses: Business[];
}

const renderSnippet = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\[\[HIGHLIGHT\]].*?\[\[ENDHIGHLIGHT\]])/g);
  return (
    <p className="text-xs text-muted-foreground mt-2 italic line-clamp-2">
      "{parts.map((part, i) => {
        if (part.startsWith('[[HIGHLIGHT]]')) {
          const content = part.replace('[[HIGHLIGHT]]', '').replace('[[ENDHIGHLIGHT]]', '');
          return <span key={i} className="font-bold text-amber-600 bg-amber-50 px-1 rounded">{content}</span>;
        }
        return part;
      })}"
    </p>
  );
};

export function ProposalCard({ businesses }: ProposalCardProps) {
  const [userId, setUserId] = useState<string>("");
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [isVoting, setIsVoting] = useState<string | null>(null);
  const [hasVotedMap, setHasVotedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let storedId = localStorage.getItem('converge_user_id');
    if (!storedId) {
        storedId = crypto.randomUUID();
        localStorage.setItem('converge_user_id', storedId);
    }
    setUserId(storedId);

    const sessionId = businesses[0]?._sessionId;
    if (sessionId) {
        const fetchVotes = async () => {
            const { data } = await supabase
                .from('votes')
                .select('business_id, user_id')
                .eq('session_id', sessionId);
            
            if (data) {
                const counts: Record<string, number> = {};
                const userVotes: Record<string, boolean> = {};
                
                data.forEach(vote => {
                    counts[vote.business_id] = (counts[vote.business_id] || 0) + 1;
                    if (vote.user_id === storedId) userVotes[vote.business_id] = true;
                });
                
                setVoteCounts(counts);
                setHasVotedMap(userVotes);
            }
        };
        fetchVotes();

        // Realtime: Listen for OTHER users
        const channel = supabase
            .channel(`session_votes_${sessionId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'votes', filter: `session_id=eq.${sessionId}` },
                (payload) => {
                    // FIX: Ignore our own votes to prevent jitter (handled optimistically)
                    if (payload.new.user_id === storedId) return; 
                    
                    const bizId = payload.new.business_id;
                    setVoteCounts(prev => ({ ...prev, [bizId]: (prev[bizId] || 0) + 1 }));
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'votes', filter: `session_id=eq.${sessionId}` },
                (payload) => {
                    if (payload.old.user_id === storedId) return;

                    const bizId = payload.old.business_id;
                    setVoteCounts(prev => ({ ...prev, [bizId]: Math.max(0, (prev[bizId] || 0) - 1) }));
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }
  }, [businesses]);

  if (!businesses?.length) return null;

  const handleVote = async (biz: Business) => {
    if (!biz._sessionId || !userId) return;

    setIsVoting(biz.id);
    
    // Optimistic Update
    const isRemoving = hasVotedMap[biz.id];
    setHasVotedMap(prev => ({ ...prev, [biz.id]: !isRemoving }));
    setVoteCounts(prev => ({ 
        ...prev, 
        [biz.id]: Math.max(0, (prev[biz.id] || 0) + (isRemoving ? -1 : 1)) 
    }));

    try {
        await submitVote(biz._sessionId, biz.id, userId);
    } catch (e) {
        console.error("Vote failed", e);
        // Revert on error
        setHasVotedMap(prev => ({ ...prev, [biz.id]: isRemoving }));
        setVoteCounts(prev => ({ 
            ...prev, 
            [biz.id]: Math.max(0, (prev[biz.id] || 0) + (isRemoving ? 1 : -1)) 
        }));
    } finally {
        setIsVoting(null);
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 p-2 snap-x">
      {businesses.map((biz) => {
        const count = voteCounts[biz.id] || 0;
        const hasVoted = hasVotedMap[biz.id];
        const loading = isVoting === biz.id;

        return (
        <Card key={biz.id} className="min-w-[280px] max-w-[280px] snap-center hover:shadow-lg transition-shadow border-slate-200">
          <div className="relative h-40 w-full overflow-hidden rounded-t-xl bg-slate-100">
            {biz.image_url ? (
                <Image 
                  src={biz.image_url} 
                  alt={biz.name} 
                  fill 
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
            ) : (
                <div className="flex items-center justify-center h-full text-slate-400">No Image</div>
            )}
            <Badge className="absolute top-2 right-2 bg-white/90 text-slate-900 shadow-sm hover:bg-white">
              {biz.price || "$$"}
            </Badge>
            
            {count > 0 && (
                <Badge className="absolute bottom-2 left-2 bg-black/70 text-white border-0 flex gap-1 items-center">
                    <Users className="w-3 h-3" /> {count}
                </Badge>
            )}
          </div>
          
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-lg leading-tight truncate">{biz.name}</CardTitle>
            <div className="flex items-center gap-1 text-sm text-slate-600 mt-1">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="font-semibold">{biz.rating}</span>
              <span className="text-slate-400">({biz.review_count})</span>
            </div>
          </CardHeader>
          
          <CardContent className="p-4 pt-0">
            <div className="flex flex-wrap gap-1 mb-3">
                {biz.categories?.slice(0, 2).map((cat, idx) => (
                    <span key={idx} className="text-[10px] uppercase tracking-wider text-slate-500 border px-1.5 py-0.5 rounded">
                        {cat.title}
                    </span>
                ))}
            </div>

            {biz.review_snippet && renderSnippet(biz.review_snippet)}

            <Button 
                onClick={() => handleVote(biz)} 
                disabled={loading}
                className={`w-full mt-4 text-white transition-all flex justify-between items-center px-4 ${
                    hasVoted ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                }`}
            >
                <span>{hasVoted ? "Voted" : "Vote"}</span>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="bg-white/20 px-2 py-0.5 rounded text-xs">{count}</span>}
            </Button>
          </CardContent>
        </Card>
      )})}
    </div>
  );
}