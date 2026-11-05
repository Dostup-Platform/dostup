import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { Product } from "@/hooks/useProducts";

const product = {
  id: "product-1",
  creator_id: "creator-1",
  title: "SAT Preparation",
  headline: "Интенсив",
  description: "Описание курса",
  price: 49000,
  image_url: null,
  video_url: null,
  media: [],
  has_schedule: false,
  is_active: true,
  slug: "sat-prep",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  kaspi_link: "https://kaspi.kz/pay/x",
  kaspi_phone: null,
  telegram_link: null,
  faq: [],
  access_duration_days: null,
  is_paused: false,
  paused_message: null,
  author_name: "SAT Academy",
  seller_handle: "sat-academy",
  seller_avatar_url: null,
  category_slug: "online-lessons",
  payment_type: "one_time",
  recurring_interval: null,
  has_free_trial: false,
  trial_days: null,
  pricing_options: [],
} as unknown as Product;

// Signed in: this is exactly the state in which the old preview leaked the
// platform navigation, so the header must be the real one, not a stub.
vi.mock("@/contexts/SimpleAuthContext", () => ({
  useSimpleAuth: () => ({
    user: { id: "user-1" },
    profileType: "creator",
    profiles: [],
    switchProfile: vi.fn(),
    status: "authenticated",
    sessionToken: "session-token",
  }),
}));

vi.mock("@/hooks/useProducts", () => ({
  useProduct: (id?: string) => ({ data: id ? product : null, isLoading: false }),
  useProductProgram: () => ({ data: [] }),
}));

const invokeApi = vi.fn().mockResolvedValue({});
vi.mock("@/lib/sessionApi", () => ({
  invokeApi: (...args: unknown[]) => invokeApi(...args),
  creatorCreds: () => ({}),
}));

import ProductPage from "@/pages/ProductPage";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { InstallPromptProvider } from "@/contexts/InstallPromptContext";

// Mounted on real routes so `useParams` behaves as it does in the app.
function renderPage(ui: ReactNode, route = "/preview/product") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <InstallPromptProvider>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path="/p/:productId" element={ui} />
              <Route path="/preview/product" element={ui} />
            </Routes>
          </MemoryRouter>
        </InstallPromptProvider>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  invokeApi.mockClear();
});


describe("product preview", () => {
  it("renders one description and keeps the legacy headline as a fallback", () => {
    renderPage(<ProductPage isPreview previewProduct={product} />);
    expect(screen.getByRole("heading", {name:"SAT Preparation"})).toBeInTheDocument();
    expect(screen.getByText("Описание курса")).toBeInTheDocument();
    expect(screen.queryByText("Интенсив")).not.toBeInTheDocument();
  });
  it("renders legacy headline-only products", () => {
    renderPage(<ProductPage isPreview previewProduct={{...product, description:null}} />);
    expect(screen.getByText("Интенсив")).toBeInTheDocument();
  });
  it("does not navigate away or call the backend from the editor preview", () => {
    const {container}=renderPage(<ProductPage isPreview previewProduct={product} />);
    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(screen.getByRole("button", {name:"Назад"})).toHaveAttribute("aria-disabled","true");
    expect(invokeApi).not.toHaveBeenCalled();
    expect(container.querySelector("header")).toBeNull();
    expect(container.querySelector("footer")).toBeNull();
  });
  it("shows the seller once beside the back control", () => {
    renderPage(<ProductPage isPreview previewProduct={product} />);
    expect(within(screen.getByTestId("product-navigation")).getByText("SAT Academy")).toBeInTheDocument();
    expect(screen.getAllByText("SAT Academy")).toHaveLength(1);
  });
  it("shows reviews placeholder even when preview has no reviews API", () => {
    renderPage(<ProductPage isPreview previewProduct={product} />);
    expect(screen.getByText("Тут будут отзывы")).toBeInTheDocument();
  });
  it("has one muted description placeholder", () => {
    renderPage(<ProductPage isPreview previewProduct={{...product,headline:null,description:"Описание продукта",preview_placeholders:["description"]}} />);
    expect(screen.getAllByText("Описание продукта")).toHaveLength(1);
    expect(screen.getByText("Описание продукта").closest("[data-placeholder]")).not.toBeNull();
  });
  it("shows the cover placeholder for a draft with no image", () => {
    renderPage(<ProductPage isPreview previewProduct={product} />);
    expect(screen.getByTestId("preview-cover-placeholder")).toBeInTheDocument();
  });
  it("renders the empty state when no draft was sent", () => {
    renderPage(<ProductPage isPreview previewProduct={null} />);
    expect(screen.getByText("Заполните форму, чтобы увидеть предпросмотр")).toBeInTheDocument();
  });
});

describe("public product navigation", () => {
  it("keeps the back control and the seller together in the header", () => {
    renderPage(<ProductPage />, "/p/sat-prep");
    const navigation=screen.getByTestId("product-navigation");
    expect(screen.getByTestId("header-below")).toContainElement(navigation);
    expect(within(navigation).getByRole("button",{name:"Назад"})).toBeInTheDocument();
    expect(within(navigation).getByRole("link",{name:/SAT Academy/})).toHaveAttribute("href","/s/sat-academy");
    expect(screen.getAllByText("SAT Academy")).toHaveLength(1);
  });
  it("preserves long product titles", () => {
    const title="Электроэнцефалографическаядиагностика";
    renderPage(<ProductPage isPreview previewProduct={{...product,title}} />);
    expect(screen.getByRole("heading",{level:1})).toHaveTextContent(title);
  });
});

describe("bottom purchase bar", () => {
  const options=[
    {id:"forever",payment_type:"one_time",price:49000,has_free_trial:false},
    {id:"month",payment_type:"recurring",recurring_interval:"1m",price:15000,has_free_trial:true,trial_days:7}
  ] as Product["pricing_options"];
  it("provides one buy button and no side card", () => {
    const {container}=renderPage(<ProductPage isPreview previewProduct={product} />);
    expect(within(screen.getByTestId("purchase-bar")).getByRole("button",{name:"Купить"})).toBeInTheDocument();
    expect(screen.getAllByRole("button",{name:"Купить"})).toHaveLength(1);
    expect(container.querySelector("aside")).toBeNull();
  });
  it("updates the price and trial when the payment option changes", () => {
    renderPage(<ProductPage isPreview previewProduct={{...product,pricing_options:options}} />);
    const bar=screen.getByTestId("purchase-bar");
    expect(within(bar).getByRole("option",{name:/навсегда/})).toBeInTheDocument();
    expect(bar.textContent).toContain("49");
    fireEvent.change(screen.getByRole("combobox",{name:"Вариант доступа"}),{target:{value:"month"}});
    expect(within(bar).getByText(/15\s*000/, { selector: "p" })).toBeInTheDocument();
    expect(within(bar).getByRole("button",{name:/Попробовать бесплатно \(7/})).toBeInTheDocument();
  });
  it("replaces purchase with the seller message for a paused product", () => {
    renderPage(<ProductPage isPreview previewProduct={{...product,is_paused:true,paused_message:"Новый поток скоро"}} />);
    expect(screen.queryByRole("button",{name:"Купить"})).not.toBeInTheDocument();
    expect(screen.getByText("Новый поток скоро")).toBeInTheDocument();
  });
});

describe("product actions", () => {
  it("puts share immediately to the right of report, below the reviews", () => {
    renderPage(<ProductPage isPreview previewProduct={product} />);
    const report=screen.getByRole("button",{name:/Пожаловаться/});
    const share=screen.getByRole("button",{name:"Поделиться"});
    expect(report.parentElement).toContainElement(share);
    expect(report.compareDocumentPosition(share)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Тут будут отзывы").compareDocumentPosition(report)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
