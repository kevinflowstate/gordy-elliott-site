// Re-export from business-plans to fix frontend URL mismatch
// Frontend calls /api/admin/training-plans but the actual route is at /api/admin/business-plans
export { GET, POST } from "@/app/api/admin/business-plans/route";
