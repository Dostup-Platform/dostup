# Dostup

Build a WEB MVP ONLY. Not a concept. Not a demo. A working product.




DO NOT add extra features.
DO NOT add marketing pages.
DO NOT add blogs, testimonials, or “about us”.




---




GOAL:
Create a web platform for selling ANY digital product where:
- user pays first
- then gets access to a private area




Digital products include:
- courses
- materials
- consultations
- group sessions
- individual sessions
- subscriptions (access-based, not recurring billing logic)
- paid access to communities or content




---




CORE RULES (STRICT):




1. PAYMENT ALWAYS BEFORE REGISTRATION
2. NO LOGIN BEFORE PAYMENT
3. ACCOUNT IS CREATED AUTOMATICALLY AFTER PAYMENT
4. USER IS REDIRECTED TO PRIVATE DASHBOARD AFTER PAYMENT
5. MOBILE-FIRST WEB APP
6. MUST SUPPORT “Add to Home Screen” (PWA-style behavior)




---




PUBLIC PRODUCT PAGE (ONE PAGE PER PRODUCT):




This page must contain ONLY:
- Large hero image or video
- Product title
- Short headline (what user gets)
- Short description
- Price
- ONE primary button: “Pay / Buy / Get access”




NO other sections.
NO footer navigation.
NO links to other pages.




This page must be usable from:
- direct link
- Instagram bio
- WhatsApp link




---




PAYMENT FLOW:




- User clicks Pay
- User pays immediately
- After successful payment:
  - create user account automatically
  - redirect user to private dashboard
  - ask user to set password AFTER payment




---




PRIVATE USER DASHBOARD (AFTER PAYMENT):




Create a private area with EXACTLY these tabs:




1. Materials
   - files
   - videos
   - text blocks
   - content uploaded by product owner




2. Schedule (OPTIONAL PER PRODUCT)
   - calendar view
   - book slot
   - cancel booking




3. Account
   - name
   - phone or email
   - list of purchased products




NO chat.
NO notifications system.
NO community feed.
NO messaging.




Links to Zoom / Telegram / WhatsApp can be provided by product owner OUTSIDE the platform.




---




SCHEDULING SYSTEM (VERY IMPORTANT):




Support TWO SEPARATE TYPES OF EVENTS:




TYPE 1: GROUP EVENTS
- one time slot
- multiple users can book
- capacity limit set by product owner




TYPE 2: INDIVIDUAL EVENTS
- one time slot
- ONLY one user can book
- slot becomes unavailable after booking




Group and individual schedules:
- must be managed separately
- must NOT conflict with each other




---




CREATOR / PRODUCT OWNER DASHBOARD:




Product owner MUST be able to:




- create product
- set price
- upload materials
- enable or disable scheduling
- create MULTIPLE schedules
- define event type (group or individual)




Product owner MUST see:
- list of paid users
- user name
- user phone or email
- booked date and time
- daily and weekly schedule view




---




TECHNICAL REQUIREMENTS:




- Web application only
- Mobile-first
- Installable as web app (Add to Home Screen)
- Same functionality in browser and installed version




---




LIMITATIONS (DO NOT BREAK THESE):




- No marketplace
- No product search
- No CRM
- No advanced roles
- No complex automation




---




THIS IS AN MVP.
Focus ONLY on:
- payment flow
- access control
- materials
- scheduling

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://dostup.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b12bd384-670e-470d-a54f-1daac6f57ab0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
