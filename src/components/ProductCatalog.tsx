import { ArrowRight, ExternalLink, PackageOpen, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/i18n";
import type { PublicProduct } from "@/lib/api-client";

type ProductCatalogProps = {
  products: PublicProduct[];
  loyaltyMode: "points" | "visits";
  emptyMessage?: string;
  className?: string;
};

export function ProductCatalog({
  products,
  loyaltyMode,
  emptyMessage,
  className = "",
}: ProductCatalogProps) {
  const { t, formatNumber } = useI18n();
  const dialogTitleId = useId();
  const [selectedProduct, setSelectedProduct] = useState<PublicProduct | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const dialog = useRef<HTMLDivElement | null>(null);

  const openProduct = (product: PublicProduct) => {
    returnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedProduct(product);
  };

  const closeProduct = () => {
    setSelectedProduct(null);
    window.requestAnimationFrame(() => returnFocus.current?.focus());
  };

  useEffect(() => {
    if (!selectedProduct) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeProduct();
      if (event.key === "Tab" && dialog.current) {
        const focusable = Array.from(
          dialog.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        );
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedProduct]);

  const rewardCost = (product: PublicProduct) =>
    loyaltyMode === "visits" ? (product.visitsCost ?? 0) : product.pointsCost;

  const productDetails = (product: PublicProduct, titleId?: string) => (
    <>
      {product.category && <small>{product.category}</small>}
      <h3 id={titleId}>{product.name}</h3>
      {product.description && <p>{product.description}</p>}
      <div className="product-price-row">
        {product.priceCents > 0 && (
          <strong>
            {new Intl.NumberFormat(undefined, {
              style: "currency",
              currency: "USD",
            }).format(product.priceCents / 100)}
          </strong>
        )}
        {rewardCost(product) > 0 && (
          <span className="product-points">
            {formatNumber(rewardCost(product))}{" "}
            {loyaltyMode === "visits" ? t("visits") : t("points")}
          </span>
        )}
      </div>
    </>
  );

  return (
    <>
      <div className={`product-grid customer-product-grid ${className}`.trim()}>
        {products.map((product) => (
          <article className="product-card customer-product-card" key={product.id}>
            <button
              type="button"
              className="product-card-open"
              onClick={() => openProduct(product)}
              aria-label={t("View full product: {productName}", { productName: product.name })}
            >
              <span className="product-card-media">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} loading="lazy" />
                ) : (
                  <span className="product-placeholder">
                    <PackageOpen />
                  </span>
                )}
                <span className="product-image-action">
                  {t("View full product")} <ArrowRight size={16} />
                </span>
              </span>
              <span className="product-card-copy">{productDetails(product)}</span>
            </button>
          </article>
        ))}
        {!products.length && emptyMessage && <p className="empty-table">{emptyMessage}</p>}
      </div>

      {selectedProduct &&
        createPortal(
          <div className="modal-backdrop product-detail-backdrop" onMouseDown={closeProduct}>
            <div
              ref={dialog}
              className="product-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby={dialogTitleId}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button
                ref={closeButton}
                type="button"
                className="modal-close"
                onClick={closeProduct}
                aria-label={t("Close product details")}
              >
                <X />
              </button>
              <div className="product-detail-media">
                {selectedProduct.imageUrl ? (
                  <img src={selectedProduct.imageUrl} alt={selectedProduct.name} />
                ) : (
                  <span className="product-placeholder">
                    <PackageOpen />
                  </span>
                )}
              </div>
              <div className="product-detail-copy">
                <span className="section-kicker">{t("Product details")}</span>
                {productDetails(selectedProduct, dialogTitleId)}
                {selectedProduct.purchaseUrl && (
                  <a
                    className="button button-primary"
                    href={selectedProduct.purchaseUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("View product")} <ExternalLink size={17} />
                  </a>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
