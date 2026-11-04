# Text-Only Certificates Design

## Goal

Replace certificate image previews with accessible text-only cards while retaining the certificate title, issue date, and issuing organization.

## Scope

The certificates section in `src/main.jsx` will:

- Store `title`, `date`, and `organization` for each certificate.
- Render each certificate as a semantic text-only card.
- Remove preview images and links that open certificate-image files.
- Preserve the existing certificates grid and its responsive placement in the page.

The obsolete files in `public/certificates` will be removed once no longer referenced. Images elsewhere on the site are out of scope and remain unchanged.

## Rendering and Styling

Each card will use an `<article>` element rather than a `<figure>`. It will present the title as the primary text, followed by the date and organization as supporting text. Existing certificate-grid layout styling will be adapted to style text cards without visual image containers.

## Accessibility

The certificate details will be selectable, readable text in document order. Removing image links eliminates redundant image alt text and external new-tab navigation; no replacement interaction is required.

## Validation

Run the project’s focused available checks after the UI change. Confirm the certificates section contains no certificate `<img>` elements, no image-link URLs, and that the production build succeeds.
