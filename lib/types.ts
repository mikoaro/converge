// apps/web/lib/types.ts
export interface YelpBusiness {
  id: string;
  name: string;
  rating: number;
  review_count: number;
  image_url?: string;
  price?: string; 
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  categories?: {
    alias: string;
    title: string;
  }[];
}

export interface VoteState {
  [businessId: string]: number; 
}