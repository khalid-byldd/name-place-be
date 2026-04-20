import { Router, Request, Response, NextFunction } from "express";
import { categoryService } from "../modules/category/category.service";
import { requireAdmin } from "../middleware";

const router = Router();

// Create a new category (admin only)
router.post(
  "/",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Category name is required" });
      }

      const category = await categoryService.createCategory({ name });

      res.status(201).json({
        message: "Category created successfully",
        category,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Get all categories
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt((req.query.limit as string) || "100");
    const offset = parseInt((req.query.offset as string) || "0");

    const allCategories = await categoryService.getAllCategories(limit, offset);

    res.json({
      categories: allCategories,
      count: allCategories.length,
    });
  } catch (error) {
    next(error);
  }
});

// Get category by ID
router.get(
  "/:categoryId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categoryId = parseInt(req.params.categoryId as string);

      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      const category = await categoryService.getCategoryById(categoryId);
      res.json(category);
    } catch (error) {
      next(error);
    }
  },
);

// Update category (admin only)
router.put(
  "/:categoryId",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categoryId = parseInt(req.params.categoryId as string);
      const { name } = req.body;

      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      const updated = await categoryService.updateCategory(categoryId, {
        name,
      });

      res.json({
        message: "Category updated successfully",
        category: updated,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Delete category (admin only)
router.delete(
  "/:categoryId",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categoryId = parseInt(req.params.categoryId as string);

      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      const result = await categoryService.deleteCategory(categoryId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
