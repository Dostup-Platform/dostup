import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { SellerStorefront } from "@/lib/catalog";

const storefront = vi.fn();

vi.mock("@/hooks/useSellerStorefront", () => ({
  useSellerStorefront: () => storefront(),
}));

vi.mock("@/contexts/SimpleAuthContext", () => ({
  useSimpleAuth: () => ({
    status: "guest",
    sessionToken: null,
    profileType: null,
    user: null,
    profiles: [],
    switchProfile: vi.fn(),
  }),
}));

import StorefrontPage from "@/pages/StorefrontPage";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { InstallPromptProvider } from "@/contexts/InstallPromptContext";

function seller(overrides: Partial<SellerStorefront> = {}): SellerStorefront {
  return {
    handle: "sat-academy",
    display_name: "SAT Academy",
    avatar_url: null,
    type: "creator",
    bio: "Мы готовим учеников к SAT",
    created_at: "2026-04-17T00:00:00.000Z",
    avg_rating: 4.8,
    review_count: 243,
    sales_count: 152,
    products: [],
    ...overrides,
  };
}

function renderStorefront(data: SellerStorefront | null, isLoading = false) {
  storefront.mockReturnValue({ data, isLoading });
  return render(
    <LanguageProvider>
      <InstallPromptProvider>
        <MemoryRouter initialEntries={["/s/sat-academy"]}>
          <Routes>
            <Route path="/s/:handle" element={<StorefrontPage />} />
          </Routes>
        </MemoryRouter>
      </InstallPromptProvider>
    </LanguageProvider>,
  );
}


describe("seller storefront",()=>{
  it("keeps name, one rating star, count and description in this order",()=>{
    renderStorefront(seller());
    const name=screen.getByRole("heading",{name:"SAT Academy"});
    const rating=screen.getByTestId("seller-rating");
    const bio=screen.getByText("Мы готовим учеников к SAT");
    expect(name.compareDocumentPosition(rating)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rating.compareDocumentPosition(bio)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rating).toHaveTextContent("4.8");
    expect(rating).toHaveTextContent("(243 отзыва)");
    expect(rating.querySelectorAll("svg")).toHaveLength(1);
    expect(rating.querySelector("svg")).toHaveClass("fill-[#FFB020]");
  });
  it("shows one yellow star and (0 отзывов) without a fictional score",()=>{
    renderStorefront(seller({review_count:0,avg_rating:0}));
    const rating=screen.getByTestId("seller-rating");
    expect(rating).toHaveTextContent("(0 отзывов)");
    expect(rating).not.toHaveTextContent("0.0");
    expect(rating.querySelectorAll("svg")).toHaveLength(1);
  });
  it("removes automatic role, joined year and sales statistics",()=>{
    renderStorefront(seller({type:"school"}));
    expect(screen.queryByText("Онлайн-школа")).not.toBeInTheDocument();
    expect(screen.queryByText(/продаж/)).not.toBeInTheDocument();
    expect(screen.queryByText(/На платформе с/)).not.toBeInTheDocument();
  });
  it("preserves a role written by the seller in their description",()=>{
    renderStorefront(seller({bio:"Преподаватель"}));
    expect(screen.getAllByText("Преподаватель")).toHaveLength(1);
  });
  it("shares the seller storefront URL",()=>{
    renderStorefront(seller());
    fireEvent.click(screen.getByRole("button",{name:"Поделиться"}));
    expect(screen.getByRole("textbox",{name:"Ссылка"})).toHaveValue(window.location.origin+"/s/sat-academy");
  });
  it("has a history-aware back button",()=>{
    renderStorefront(seller());
    expect(screen.getByRole("button",{name:"Назад"})).toBeInTheDocument();
  });
  it("shows the not-found state",()=>{
    renderStorefront(null);
    expect(screen.queryByRole("heading",{name:"SAT Academy"})).not.toBeInTheDocument();
  });
});
