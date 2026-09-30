import { products, pricing_history, stock_movements, categories, outlets } from '../../db/schema';
import { eq, and, isNull, inArray, desc } from 'drizzle-orm';
import type { ProductInput, OpnameInput } from './schema';

export const getProducts = async (db: any, outletId: string) => {
  return await db
    .select({
      id: products.id,
      outlet_id: products.outlet_id,
      category_id: products.category_id,
      category_name: categories.name,
      outlet_name: outlets.name,
      sku: products.sku,
      name: products.name,
      description: products.description,
      unit: products.unit,
      price: products.price,
      cost_price: products.cost_price,
      stock: products.stock,
      track_stock: products.track_stock,
      is_available: products.is_available,
      image_url: products.image_url,
      created_at: products.created_at,
      updated_at: products.updated_at,
    })
    .from(products)
    .leftJoin(categories, eq(products.category_id, categories.id))
    .leftJoin(outlets, eq(products.outlet_id, outlets.id))
    .where(and(eq(products.outlet_id, outletId), isNull(products.deleted_at)))
    .orderBy(desc(products.created_at));
};

export const getAllProducts = async (db: any, allowedOutletIds?: string[] | null) => {
  if (allowedOutletIds && allowedOutletIds.length === 0) {
    return [];
  }

  const query = db
    .select({
      id: products.id,
      outlet_id: products.outlet_id,
      category_id: products.category_id,
      category_name: categories.name,
      outlet_name: outlets.name,
      sku: products.sku,
      name: products.name,
      description: products.description,
      unit: products.unit,
      price: products.price,
      cost_price: products.cost_price,
      stock: products.stock,
      track_stock: products.track_stock,
      is_available: products.is_available,
      image_url: products.image_url,
      created_at: products.created_at,
      updated_at: products.updated_at,
    })
    .from(products)
    .leftJoin(categories, eq(products.category_id, categories.id))
    .leftJoin(outlets, eq(products.outlet_id, outlets.id));

  if (allowedOutletIds && allowedOutletIds.length > 0) {
    return await query
      .where(and(inArray(products.outlet_id, allowedOutletIds), isNull(products.deleted_at)))
      .orderBy(desc(products.created_at));
  }

  return await query
    .where(isNull(products.deleted_at))
    .orderBy(desc(products.created_at));
};

export const getProductById = async (db: any, outletId: string, id: string) => {
  const whereClause =
    outletId === 'ALL'
      ? and(eq(products.id, id), isNull(products.deleted_at))
      : and(eq(products.id, id), eq(products.outlet_id, outletId), isNull(products.deleted_at));

  const [product] = await db
    .select({
      id: products.id,
      outlet_id: products.outlet_id,
      category_id: products.category_id,
      category_name: categories.name,
      outlet_name: outlets.name,
      sku: products.sku,
      name: products.name,
      description: products.description,
      unit: products.unit,
      price: products.price,
      cost_price: products.cost_price,
      stock: products.stock,
      track_stock: products.track_stock,
      is_available: products.is_available,
      image_url: products.image_url,
      created_at: products.created_at,
      updated_at: products.updated_at,
    })
    .from(products)
    .leftJoin(categories, eq(products.category_id, categories.id))
    .leftJoin(outlets, eq(products.outlet_id, outlets.id))
    .where(whereClause)
    .limit(1);

  return product || null;
};

export const createProduct = async (db: any, outletId: string, data: ProductInput) => {
  const [newProduct] = await db
    .insert(products)
    .values({
      ...data,
      outlet_id: outletId,
    })
    .returning();
  return newProduct;
};

export const updateProduct = async (
  db: any,
  outletId: string,
  id: string,
  data: Partial<ProductInput>,
  userId: string
) => {
  return await db.transaction(async (tx: any) => {
    const whereClause =
      outletId === 'ALL'
        ? and(eq(products.id, id), isNull(products.deleted_at))
        : and(eq(products.id, id), eq(products.outlet_id, outletId), isNull(products.deleted_at));

    const currentProduct = await tx.query.products.findFirst({
      where: whereClause,
    });

    if (!currentProduct) {
      throw new Error('Product not found');
    }

    const actualOutletId = currentProduct.outlet_id;

    if (data.price !== undefined && data.price !== currentProduct.price) {
      await tx.insert(pricing_history).values({
        product_id: id,
        outlet_id: actualOutletId,
        field_changed: 'price',
        old_value: currentProduct.price,
        new_value: data.price,
        changed_by: userId,
      });
    }

    if (data.cost_price !== undefined && data.cost_price !== currentProduct.cost_price) {
      await tx.insert(pricing_history).values({
        product_id: id,
        outlet_id: actualOutletId,
        field_changed: 'cost_price',
        old_value: currentProduct.cost_price,
        new_value: data.cost_price,
        changed_by: userId,
      });
    }

    const [updatedProduct] = await tx
      .update(products)
      .set({ ...data, updated_at: new Date() })
      .where(eq(products.id, id))
      .returning();

    return updatedProduct;
  });
};

export const deleteProduct = async (db: any, outletId: string, id: string) => {
  const whereClause =
    outletId === 'ALL'
      ? eq(products.id, id)
      : and(eq(products.id, id), eq(products.outlet_id, outletId));

  const [deletedProduct] = await db
    .update(products)
    .set({ deleted_at: new Date() })
    .where(whereClause)
    .returning();
  return deletedProduct;
};

export const performOpname = async (
  db: any,
  outletId: string,
  userId: string,
  data: OpnameInput
) => {
  return await db.transaction(async (tx: any) => {
    const whereClause =
      outletId === 'ALL'
        ? and(eq(products.id, data.product_id), isNull(products.deleted_at))
        : and(
            eq(products.id, data.product_id),
            eq(products.outlet_id, outletId),
            isNull(products.deleted_at)
          );

    const current = await tx.query.products.findFirst({
      where: whereClause,
    });

    if (!current) {
      throw new Error('Product not found');
    }

    if (!current.track_stock) {
      throw new Error('Product does not track stock');
    }

    const actualOutletId = current.outlet_id;
    const quantity = data.actual_stock - current.stock;

    if (quantity !== 0) {
      await tx.insert(stock_movements).values({
        product_id: data.product_id,
        outlet_id: actualOutletId,
        type: 'opname',
        quantity: quantity,
        notes: data.notes || 'Stock opname',
        created_by: userId,
      });

      await tx
        .update(products)
        .set({ stock: data.actual_stock, updated_at: new Date() })
        .where(eq(products.id, data.product_id));
    }

    let shouldUpdatePrice = false;
    let priceUpdate: any = {};

    if (data.price !== undefined && data.price !== current.price) {
      await tx.insert(pricing_history).values({
        product_id: data.product_id,
        outlet_id: actualOutletId,
        field_changed: 'price',
        old_value: current.price,
        new_value: data.price,
        changed_by: userId,
      });
      priceUpdate.price = data.price;
      shouldUpdatePrice = true;
    }

    if (data.cost_price !== undefined && data.cost_price !== current.cost_price) {
      await tx.insert(pricing_history).values({
        product_id: data.product_id,
        outlet_id: actualOutletId,
        field_changed: 'cost_price',
        old_value: current.cost_price,
        new_value: data.cost_price,
        changed_by: userId,
      });
      priceUpdate.cost_price = data.cost_price;
      shouldUpdatePrice = true;
    }

    if (shouldUpdatePrice) {
      await tx
        .update(products)
        .set({ ...priceUpdate, updated_at: new Date() })
        .where(eq(products.id, data.product_id));
    }

    return true;
  });
};
