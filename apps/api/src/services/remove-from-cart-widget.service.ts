import type { ToolDefinition } from './llm.service';
import {
  MAX_QUANTITY,
  runCartWidgetAction,
  toPositiveInt,
  type AddToCartContext,
  type AddToCartResult,
} from './add-to-cart-widget.service';

/**
 * Tool nativa `remove_from_cart_widget`: espejo de `add_to_cart_widget` para sacar un producto
 * del carrito REAL de la tienda Tiendanube. Reusa toda la infraestructura (pending en Redis, mensaje
 * invisible con `metadata.cart_action` — acá con `action: 'remove'` —, espera bloqueante del resultado y
 * POST /api/widget/:agentId/cart-result). Ver add-to-cart-widget.service.ts.
 *
 * `quantity` es REQUERIDA: la doc de NubeSDK solo muestra `cart:remove` con `quantity: 1` y no dice qué
 * pasa si se omite, si excede lo que hay en el carrito, ni si sacar la cantidad completa elimina la línea.
 * No se asume "sacar todo".
 */

export const REMOVE_FROM_CART_TOOL_NAME = 'remove_from_cart_widget';

export const removeFromCartWidgetToolDef: ToolDefinition = {
  name: REMOVE_FROM_CART_TOOL_NAME,
  description: [
    'Removes a product from the shopper\'s REAL store cart (the one shown in the store header) while they browse the Tiendanube storefront.',
    'Use it only when the shopper clearly asks to remove something from their cart.',
    'You MUST pass the real numeric product_id and variant_id (the ones you used when adding it, or from get_product) and the exact quantity to remove.',
    'quantity is required: if the shopper wants to remove the item entirely, use the total units in their cart (the ones you added); if you are not sure how many are in the cart, ask.',
    'The tool waits (up to ~15 seconds) for the storefront to confirm and returns the real outcome: only tell the shopper it was removed if the result says so.',
    'If it fails or cannot be confirmed, do NOT retry in a loop: explain it and ask the shopper to remove it manually from their cart.',
  ].join(' '),
  parameters: {
    type: 'object',
    properties: {
      product_id: { type: 'integer', description: 'Tiendanube product id (numeric)' },
      variant_id: { type: 'integer', description: 'Tiendanube variant id (numeric) of the item to remove' },
      quantity: { type: 'integer', description: `Units to remove (1-${MAX_QUANTITY})` },
    },
    required: ['product_id', 'variant_id', 'quantity'],
  },
};

export async function handleRemoveFromCartWidget(
  args: Record<string, unknown>,
  context: AddToCartContext
): Promise<AddToCartResult> {
  const productId = toPositiveInt(args['product_id']);
  const variantId = toPositiveInt(args['variant_id']);
  const quantity = toPositiveInt(args['quantity']);

  if (!productId) {
    return { success: false, message: 'Falta un product_id numérico válido (el mismo con el que se agregó el producto).' };
  }
  if (!variantId) {
    return { success: false, message: 'Falta variant_id. Usa el variant_id real del producto en el carrito; no lo adivines.' };
  }
  if (!quantity || quantity > MAX_QUANTITY) {
    return {
      success: false,
      message: `quantity es obligatoria y debe ser un entero entre 1 y ${MAX_QUANTITY} (unidades a sacar). Si no sabes cuántas hay en el carrito, pregúntale al comprador.`,
    };
  }

  return runCartWidgetAction('remove', { productId, variantId, quantity }, context);
}
