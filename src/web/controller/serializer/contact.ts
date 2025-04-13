import type { Contact } from '../../../schema/schema.js';

type ContactResponse = {
  id: number;
  email: string;
  name: string;
  createdAt: Date | null;
  is_verified: boolean | null;
  role: string | null;
  phone: string | null;
  profile_picture: string | null;
  bio: string | null;
  stripe_customer_id: string | null;
  subscription_status: string | null;
  auth_provider: 'local' | 'google';
};

export async function serializeContact(contact: Contact): Promise<ContactResponse> {
  return {
    id: contact.id,
    email: contact.email,
    name: contact.name,
    createdAt: contact.createdAt,
    is_verified: contact.is_verified,
    role: contact.role,
    phone: contact.phone,
    profile_picture: contact.profile_picture,
    bio: contact.bio,
    stripe_customer_id: contact.stripe_customer_id,
    subscription_status: contact.subscription_status,
    auth_provider: contact.auth_provider ?? 'local',
  };
}
