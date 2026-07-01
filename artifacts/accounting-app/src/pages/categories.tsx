import { useState } from "react";
import { 
  useListCategories, 
  useCreateCategory, 
  useDeleteCategory, 
  useCreateSubcategory, 
  useDeleteSubcategory,
  getListCategoriesQueryKey 
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useQueryClient } from "@tanstack/react-query";
import { EmojiPicker } from "@/components/emoji-picker";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Categories() {
  const { data: categories, isLoading } = useListCategories();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const createSubcategory = useCreateSubcategory();
  const deleteSubcategory = useDeleteSubcategory();

  const [isCatOpen, setIsCatOpen] = useState(false);
  const [catData, setCatData] = useState({ name: "", emoji: "🏷️" });

  const [isSubOpen, setIsSubOpen] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
  const [subData, setSubData] = useState({ name: "", emoji: "📌" });

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    createCategory.mutate({ data: catData }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
        setIsCatOpen(false);
        setCatData({ name: "", emoji: "🏷️" });
        toast({ title: "تم إضافة التصنيف الرئيسي" });
      }
    });
  };

  const handleCreateSubcategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParentId) return;
    createSubcategory.mutate({ data: { categoryId: selectedParentId, ...subData } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
        setIsSubOpen(false);
        setSubData({ name: "", emoji: "📌" });
        toast({ title: "تم إضافة التصنيف الفرعي" });
      }
    });
  };

  const handleDeleteCat = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("حذف هذا التصنيف سيحذف جميع التصنيفات الفرعية. متأكد؟")) {
      deleteCategory.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
        }
      });
    }
  };

  const handleDeleteSub = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا التصنيف الفرعي؟")) {
      deleteSubcategory.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
        }
      });
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">تصنيفات المصروفات</h2>
        
        <Dialog open={isCatOpen} onOpenChange={setIsCatOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="ml-2 h-4 w-4" /> تصنيف رئيسي</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة تصنيف رئيسي</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div className="flex gap-4">
                <div className="space-y-2">
                  <Label>الرمز</Label>
                  <EmojiPicker value={catData.emoji} onChange={(emoji) => setCatData({...catData, emoji})} />
                </div>
                <div className="space-y-2 flex-1">
                  <Label>اسم التصنيف</Label>
                  <Input required value={catData.name} onChange={e => setCatData({...catData, name: e.target.value})} placeholder="مثال: المنزل" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createCategory.isPending}>حفظ</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isSubOpen} onOpenChange={setIsSubOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة تصنيف فرعي</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubcategory} className="space-y-4">
            <div className="flex gap-4">
              <div className="space-y-2">
                <Label>الرمز</Label>
                <EmojiPicker value={subData.emoji} onChange={(emoji) => setSubData({...subData, emoji})} />
              </div>
              <div className="space-y-2 flex-1">
                <Label>الاسم</Label>
                <Input required value={subData.name} onChange={e => setSubData({...subData, name: e.target.value})} placeholder="مثال: الإيجار" />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={createSubcategory.isPending}>حفظ</Button>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : (
        <Accordion type="multiple" className="w-full space-y-4">
          {categories?.map(cat => (
            <AccordionItem key={cat.id} value={cat.id.toString()} className="border rounded-lg bg-card px-4">
              <div className="flex items-center">
                <AccordionTrigger className="flex-1 hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{cat.emoji}</span>
                    <span className="font-bold text-lg">{cat.name}</span>
                  </div>
                </AccordionTrigger>
                <div className="flex items-center gap-2 pr-4">
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedParentId(cat.id); setIsSubOpen(true); }}>
                    <Plus className="h-4 w-4 ml-1" /> فرعي
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={(e) => handleDeleteCat(cat.id, e)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <AccordionContent className="pt-0 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t">
                  {cat.subcategories?.map(sub => (
                    <div key={sub.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md group">
                      <div className="flex items-center gap-2">
                        <span>{sub.emoji}</span>
                        <span className="font-medium">{sub.name}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => handleDeleteSub(sub.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {(!cat.subcategories || cat.subcategories.length === 0) && (
                    <div className="col-span-full text-sm text-muted-foreground text-center py-2">
                      لا توجد تصنيفات فرعية
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
          {categories?.length === 0 && (
            <div className="text-center p-12 border border-dashed rounded-lg text-muted-foreground">
              قم بإضافة تصنيفات لمصروفاتك (مثال: طعام، مواصلات، فواتير)
            </div>
          )}
        </Accordion>
      )}
    </div>
  );
}
