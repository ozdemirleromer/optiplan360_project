import { useEffect } from "react";

const FORCE_ENABLE_SELECTOR = [
  "button[disabled]",
  "button[aria-disabled='true']",
  "input[type='button'][disabled]",
  "input[type='submit'][disabled]",
  "input[type='reset'][disabled]",
  "input[type='button'][aria-disabled='true']",
  "input[type='submit'][aria-disabled='true']",
  "input[type='reset'][aria-disabled='true']",
  "[role='button'][aria-disabled='true']",
].join(", ");

function markElementActive(element: Element) {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  Object.getOwnPropertyNames(element).forEach((key) => {
    if (!key.startsWith("__reactProps$")) {
      return;
    }

    const reactProps = (element as Record<string, unknown>)[key];
    if (!reactProps || typeof reactProps !== "object") {
      return;
    }

    const propsRecord = reactProps as Record<string, unknown>;
    if (!("disabled" in propsRecord) && !("aria-disabled" in propsRecord)) {
      return;
    }

    const nextProps: Record<string, unknown> = { ...propsRecord, disabled: false };
    delete nextProps["aria-disabled"];
    Object.defineProperty(element, key, {
      value: nextProps,
      configurable: true,
      enumerable: false,
      writable: true,
    });
  });

  if ("disabled" in element) {
    try {
      (element as HTMLButtonElement | HTMLInputElement).disabled = false;
    } catch {
      // Ignore non-form elements that expose a readonly disabled property.
    }
  }

  element.removeAttribute("disabled");
  if (element.getAttribute("aria-disabled") === "true") {
    element.removeAttribute("aria-disabled");
  }
  element.dataset.forceEnabled = "true";
}

function scanButtons(root: ParentNode) {
  if (root instanceof Element && root.matches(FORCE_ENABLE_SELECTOR)) {
    markElementActive(root);
  }

  root.querySelectorAll(FORCE_ENABLE_SELECTOR).forEach((element) => {
    markElementActive(element);
  });
}

export function useForceActiveButtons() {
  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    scanButtons(document);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes") {
          const target = mutation.target as Element;
          if (target.matches(FORCE_ENABLE_SELECTOR)) {
            markElementActive(target);
          }
          return;
        }

        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            scanButtons(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["disabled", "aria-disabled"],
    });

    return () => observer.disconnect();
  }, []);
}
