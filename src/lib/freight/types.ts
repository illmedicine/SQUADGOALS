import type { CargoSpace, ShipItem } from './cargo';
import type { TruckSpec } from './trucks';
import type { LatLng } from '../geo';

export type Role = 'driver' | 'shipper';

export type Itinerary = {
  stops: string[];        // city ids, in travel order
  departAt: number;       // epoch ms
  // Seeded drivers repeat their run on a loop so the network always looks alive.
  repeatEveryMs?: number;
  roundTrip?: boolean;    // alternate direction each repetition (out and back)
};

export type Driver = {
  id: string;
  name: string;
  handle?: string;
  photoURL?: string | null;
  avatarColor: string;
  homeBase: string;       // city id
  rating: number;
  tripsCompleted: number;
  yearsDriving: number;
  bio: string;
  mcNumber?: string;
  truck: TruckSpec;
  cargo: CargoSpace;
  itinerary: Itinerary | null;
  online: boolean;
  seeded?: boolean;
  live?: LatLng & { at: number };   // real drivers publish GPS while online
  booked?: { sqft: number; lbs: number };  // space already sold, kept current by the driver
  updatedAt?: number;
};

export type BookingStatus = 'requested' | 'accepted' | 'declined' | 'picked_up' | 'delivered' | 'cancelled';

export type Booking = {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: BookingStatus;
  driverId: string;
  driverName: string;
  customerId: string;
  customerName: string;
  customerPhoto?: string | null;
  item: ShipItem;
  pickup: { cityId: string; address: string; lat: number; lng: number };
  dropoff: { cityId: string; address: string; lat: number; lng: number };
  pickupMile: number;
  dropoffMile: number;
  pickupEta: number;
  dropoffEta: number;
  journeyDepartAt: number;
  price: { total: number; driverPayout: number; miles: number };
  footprintSqft: number;
  history: { status: BookingStatus; at: number }[];
};
