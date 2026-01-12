import { Product, Material, Schedule, TimeSlot, Booking, Purchase, User } from "@/types";

// Demo product for preview
export const demoProduct: Product = {
  id: "demo-product-1",
  title: "Complete Digital Marketing Masterclass",
  headline: "Learn to grow your business online in 30 days",
  description: "Master social media, SEO, paid ads, and email marketing. Includes 12 video modules, worksheets, and 2 live Q&A sessions.",
  price: 9900,
  currency: "USD",
  image_url: "",
  has_schedule: true,
  creator_id: "creator-1",
  created_at: new Date().toISOString(),
};

export const demoMaterials: Material[] = [
  {
    id: "mat-1",
    product_id: "demo-product-1",
    title: "Module 1: Introduction to Digital Marketing",
    type: "video",
    content: "https://example.com/video1.mp4",
    order: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: "mat-2",
    product_id: "demo-product-1",
    title: "Social Media Strategy Workbook",
    type: "file",
    content: "",
    file_url: "https://example.com/workbook.pdf",
    order: 2,
    created_at: new Date().toISOString(),
  },
  {
    id: "mat-3",
    product_id: "demo-product-1",
    title: "Quick Start Guide",
    type: "text",
    content: "Welcome to the masterclass! Here's how to get the most out of your learning experience...\n\n1. Watch the video modules in order\n2. Complete each workbook exercise\n3. Join the live Q&A sessions\n4. Apply what you learn to your business",
    order: 3,
    created_at: new Date().toISOString(),
  },
];

export const demoSchedules: Schedule[] = [
  {
    id: "schedule-1",
    product_id: "demo-product-1",
    title: "Weekly Group Q&A",
    type: "group",
    capacity: 20,
    created_at: new Date().toISOString(),
  },
  {
    id: "schedule-2",
    product_id: "demo-product-1",
    title: "1-on-1 Strategy Call",
    type: "individual",
    created_at: new Date().toISOString(),
  },
];

// Generate time slots for next 7 days
export const generateDemoTimeSlots = (): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  const now = new Date();
  
  for (let day = 1; day <= 7; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() + day);
    
    // Group session slots (10am, 2pm)
    [10, 14].forEach((hour, idx) => {
      const start = new Date(date);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start);
      end.setHours(hour + 1);
      
      slots.push({
        id: `slot-group-${day}-${idx}`,
        schedule_id: "schedule-1",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        is_available: Math.random() > 0.3,
      });
    });
    
    // Individual session slots (11am, 3pm, 5pm)
    [11, 15, 17].forEach((hour, idx) => {
      const start = new Date(date);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start);
      end.setMinutes(30);
      
      slots.push({
        id: `slot-ind-${day}-${idx}`,
        schedule_id: "schedule-2",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        is_available: Math.random() > 0.4,
      });
    });
  }
  
  return slots;
};

export const demoUser: User = {
  id: "user-1",
  email: "demo@example.com",
  name: "Demo User",
  phone: "+1 555-123-4567",
  created_at: new Date().toISOString(),
};

export const demoPurchases: Purchase[] = [
  {
    id: "purchase-1",
    user_id: "user-1",
    product_id: "demo-product-1",
    amount: 9900,
    status: "completed",
    created_at: new Date().toISOString(),
  },
];

export const demoBookings: Booking[] = [];
