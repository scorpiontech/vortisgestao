# Plan: Automatic Barcode Generation

Implement automatic generation of SKUs (barcodes) for products when they are missing during manual registration or XML import.

## Technical Details

- **Helper Function**: Create a reusable utility to generate unique barcodes (EAN-13 format or sequential/timestamp-based fallback).
- **Manual Registration**: Update `src/pages/Estoque.tsx` to call this utility when the SKU field is empty upon saving.
- **XML Import**: Update `src/components/XmlProductImport.tsx` to use the utility for items missing valid EAN/Product codes.
- **UI Update**: Add a "Generate Barcode" button next to the SKU input in `Estoque.tsx` for manual triggers.

## Steps

1. Create `src/lib/barcodeGenerator.ts` with barcode generation logic.
2. Modify `src/pages/Estoque.tsx` to integrate the generator in `handleSave` and add a manual trigger button.
3. Modify `src/components/XmlProductImport.tsx` to ensure every imported product gets a valid SKU.
4. Verify functionality in the preview.
