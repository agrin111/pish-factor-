import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { ProductsView } from '@/components/products-view';
import { getCompanySettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const user = await requireUser();
  const company = await getCompanySettings();

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { category: { select: { id: true, name: true } } },
    }),
    prisma.productCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    }),
  ]);

  return (
    <ProductsView
      isAdmin={user.role === 'ADMIN'}
      currency={company.currency}
      categories={categories.map((category) => ({
        id: category.id,
        name: category.name,
        sortOrder: category.sortOrder,
        isActive: category.isActive,
        productCount: category._count.products,
      }))}
      products={products.map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        categoryId: product.categoryId,
        categoryName: product.category?.name ?? null,
        factory: product.factory,
        specs: product.specs,
        size: product.size,
        thickness: product.thickness,
        length: product.length,
        unit: product.unit,
        weightPerUnitKg: product.weightPerUnitKg.toString(),
        unitPrice: product.unitPrice.toString(),
        description: product.description,
        isActive: product.isActive,
      }))}
    />
  );
}
