import { db } from "../../db/client";
import { categories } from "../../db/schema";
import { eq, desc } from "drizzle-orm";

export interface CreateCategoryInput {
  name: string;
}

export interface UpdateCategoryInput {
  name?: string;
}

export const categoryService = {
  async createCategory(input: CreateCategoryInput) {
    if (!input.name || input.name.trim().length === 0) {
      throw { status: 400, message: "Category name is required" };
    }

    // Check if category with same name already exists
    const existing = await db.query.categories.findFirst({
      where: eq(categories.name, input.name.trim()),
    });

    if (existing) {
      throw { status: 400, message: "Category with this name already exists" };
    }

    const newCategory = await db
      .insert(categories)
      .values({
        name: input.name.trim(),
      })
      .returning();

    return {
      id: newCategory[0].id,
      name: newCategory[0].name,
      createdAt: newCategory[0].createdAt,
    };
  },

  async getCategoryById(categoryId: number) {
    const category = await db.query.categories.findFirst({
      where: eq(categories.id, categoryId),
    });

    if (!category) {
      throw { status: 404, message: "Category not found" };
    }

    return {
      id: category.id,
      name: category.name,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  },

  async getAllCategories(limit = 100, offset = 0) {
    const allCategories = await db.query.categories.findMany({
      limit,
      offset,
      orderBy: desc(categories.createdAt),
    });

    return allCategories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
    }));
  },

  async updateCategory(categoryId: number, input: UpdateCategoryInput) {
    const category = await db.query.categories.findFirst({
      where: eq(categories.id, categoryId),
    });

    if (!category) {
      throw { status: 404, message: "Category not found" };
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) {
      const trimmedName = input.name.trim();

      if (trimmedName.length === 0) {
        throw { status: 400, message: "Category name cannot be empty" };
      }

      // Check if another category with same name exists
      const existing = await db.query.categories.findFirst({
        where: eq(categories.name, trimmedName),
      });

      if (existing && existing.id !== categoryId) {
        throw { status: 400, message: "Category with this name already exists" };
      }

      updateData.name = trimmedName;
    }

    const updated = await db
      .update(categories)
      .set(updateData)
      .where(eq(categories.id, categoryId))
      .returning();

    return {
      id: updated[0].id,
      name: updated[0].name,
      updatedAt: updated[0].updatedAt,
    };
  },

  async deleteCategory(categoryId: number) {
    const category = await db.query.categories.findFirst({
      where: eq(categories.id, categoryId),
    });

    if (!category) {
      throw { status: 404, message: "Category not found" };
    }

    await db.delete(categories).where(eq(categories.id, categoryId));

    return { message: "Category deleted successfully" };
  },
};
