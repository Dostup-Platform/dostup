import { Navigate } from "react-router-dom";
import LegalDocumentBody from "@/components/legal/LegalDocumentBody";
import PublicFooter from "@/components/layout/PublicFooter";
import MarketplaceHeader from "@/components/marketplace/MarketplaceHeader";
import PublicContainer from "@/components/marketplace/PublicContainer";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLegalDocument, type LegalDocId } from "@/lib/legalDocs";

type LegalPageProps = {
  docId: LegalDocId;
};

const LegalPage = ({ docId }: LegalPageProps) => {
  const { t } = useLanguage();
  const document = getLegalDocument(docId);

  if (!document) {
    return <Navigate to="/" replace />;
  }

  const titleKey = docId === "terms" ? "termsPageTitle" : "privacyPageTitle";
  const pageTitle = t(titleKey).startsWith("TODO") ? document.title : t(titleKey);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketplaceHeader />
      <main className="flex-1 py-10 md:py-14">
        <PublicContainer>
          <article className="mx-auto max-w-[720px]">
            <h1 className="text-[20px] font-semibold text-[#1F2328]">{pageTitle}</h1>
            <p className="mt-2 text-base text-[#6B7280]">
              {t("legalLastUpdated", { date: document.updated })}
            </p>
            <div className="mt-8">
              <LegalDocumentBody markdown={document.body} />
            </div>
          </article>
        </PublicContainer>
      </main>
      <PublicFooter />
    </div>
  );
};

export default LegalPage;
