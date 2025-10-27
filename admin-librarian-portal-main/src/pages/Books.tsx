import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, BookOpen, User, BookMarked, Edit, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { z } from "zod";

interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  publisher: string;
  publication_year: number;
  description: string;
  available_copies: number;
  total_copies: number;
  category_id: string;
}

interface Category {
  id: string;
  name: string;
}

// Validation schema for book data
const bookSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(500, "Title must be less than 500 characters"),
  author: z.string().trim().min(1, "Author is required").max(200, "Author must be less than 200 characters"),
  isbn: z.string().trim().max(20, "ISBN must be less than 20 characters").optional().or(z.literal("")),
  publisher: z.string().trim().max(200, "Publisher must be less than 200 characters").optional().or(z.literal("")),
  publication_year: z.number().int().min(1000, "Year must be after 1000").max(new Date().getFullYear() + 1, "Year cannot be in the future").optional().or(z.literal(NaN)),
  description: z.string().trim().max(5000, "Description must be less than 5000 characters").optional().or(z.literal("")),
  total_copies: z.number().int().min(1, "Must have at least 1 copy").max(10000, "Cannot exceed 10000 copies"),
  available_copies: z.number().int().min(0, "Cannot be negative"),
  category_id: z.string().uuid("Invalid category"),
});

export default function Books() {
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [deleteBookId, setDeleteBookId] = useState<string | null>(null);
  const { userRole, user } = useAuth();
  const { toast } = useToast();
  const canManageBooks = userRole === "admin" || userRole === "librarian";
  const [addCategoryId, setAddCategoryId] = useState<string>("");
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  useEffect(() => {
    fetchBooks();
    fetchCategories();
  }, []);

  const fetchBooks = async () => {
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .order("title");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch books",
        variant: "destructive",
      });
    } else {
      setBooks(data || []);
    }
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching categories:", error);
    } else {
      setCategories(data || []);
    }
  };

  const handleAddBook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      // Parse and validate form data
      const rawData = {
        title: formData.get("title") as string,
        author: formData.get("author") as string,
        isbn: formData.get("isbn") as string || "",
        publisher: formData.get("publisher") as string || "",
        publication_year: parseInt(formData.get("publication_year") as string) || NaN,
        description: formData.get("description") as string || "",
        total_copies: parseInt(formData.get("total_copies") as string),
        available_copies: parseInt(formData.get("total_copies") as string),
        category_id: addCategoryId,
      };

      if (!addCategoryId) {
        toast({
          title: "Validation Error",
          description: "Please select a category",
          variant: "destructive",
        });
        return;
      }
      const validatedData = bookSchema.parse(rawData);
      // Prepare data for insertion (remove NaN values)
      const insertData: any = { ...validatedData };
      if (isNaN(validatedData.publication_year as number)) {
        delete insertData.publication_year;
      }

      const { error } = await supabase.from("books").insert(insertData);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to add book",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Book added successfully",
        });
        setIsAddDialogOpen(false);
        fetchBooks();
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        });
      }
    }
  };

  const handleAddToMyBooks = async (bookId: string) => {
    if (!user) {
      toast({
        title: "Error",
        description: "Please login to borrow books",
        variant: "destructive",
      });
      return;
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14); // 14 days from now

    const { error } = await supabase.from("borrow_records").insert({
      book_id: bookId,
      member_id: user.id,
      issued_by: user.id,
      due_date: dueDate.toISOString(),
      status: "issued",
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to borrow book",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Book added to your collection!",
      });
      fetchBooks(); // Refresh to update available copies
    }
  };

  const handleEditBook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingBook) return;

    const formData = new FormData(e.currentTarget);

    try {
      // Parse and validate form data
      const rawData = {
        title: formData.get("title") as string,
        author: formData.get("author") as string,
        isbn: formData.get("isbn") as string || "",
        publisher: formData.get("publisher") as string || "",
        publication_year: parseInt(formData.get("publication_year") as string) || NaN,
        description: formData.get("description") as string || "",
        total_copies: parseInt(formData.get("total_copies") as string),
        available_copies: parseInt(formData.get("available_copies") as string),
        category_id: editCategoryId,
      };

      const validatedData = bookSchema.parse(rawData);

      // Prepare data for update (remove NaN values)
      const updateData: any = { ...validatedData };
      if (isNaN(validatedData.publication_year as number)) {
        delete updateData.publication_year;
      }

      const { error } = await supabase
        .from("books")
        .update(updateData)
        .eq("id", editingBook.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update book",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Book updated successfully",
        });
        setIsEditDialogOpen(false);
        setEditingBook(null);
        fetchBooks();
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        });
      }
    }
  };

  const handleDeleteBook = async () => {
    if (!deleteBookId) return;

    const { error } = await supabase.from("books").delete().eq("id", deleteBookId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete book",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Book deleted successfully",
      });
      setDeleteBookId(null);
      fetchBooks();
    }
  };

  const openEditDialog = (book: Book) => {
    setEditingBook(book);
    setEditCategoryId(book.category_id);
    setIsEditDialogOpen(true);
  };
  const filteredBooks = books.filter((book) => {
    const matchesSearch =
      book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.author.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || book.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Book Catalog</h1>
            <p className="text-muted-foreground">Browse and search our collection</p>
          </div>
          {canManageBooks && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Book
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Book</DialogTitle>
                  <DialogDescription className="sr-only">Fill the form to add a new book.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddBook} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input id="title" name="title" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="author">Author *</Label>
                      <Input id="author" name="author" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="isbn">ISBN</Label>
                      <Input id="isbn" name="isbn" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="publisher">Publisher</Label>
                      <Input id="publisher" name="publisher" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="publication_year">Publication Year</Label>
                      <Input
                        id="publication_year"
                        name="publication_year"
                        type="number"
                        min="1000"
                        max="2100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category_id">Category *</Label>
                      <Select value={addCategoryId} onValueChange={setAddCategoryId} required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="total_copies">Total Copies *</Label>
                    <Input
                      id="total_copies"
                      name="total_copies"
                      type="number"
                      min="1"
                      defaultValue="1"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" name="description" rows={3} />
                  </div>
                  <Button type="submit" className="w-full">Add Book</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Edit Book Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Book</DialogTitle>
              <DialogDescription className="sr-only">Update book details.</DialogDescription>
            </DialogHeader>
            {editingBook && (
              <form onSubmit={handleEditBook} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-title">Title *</Label>
                    <Input id="edit-title" name="title" defaultValue={editingBook.title} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-author">Author *</Label>
                    <Input id="edit-author" name="author" defaultValue={editingBook.author} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-isbn">ISBN</Label>
                    <Input id="edit-isbn" name="isbn" defaultValue={editingBook.isbn} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-publisher">Publisher</Label>
                    <Input id="edit-publisher" name="publisher" defaultValue={editingBook.publisher} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-publication_year">Publication Year</Label>
                    <Input
                      id="edit-publication_year"
                      name="publication_year"
                      type="number"
                      min="1000"
                      max="2100"
                      defaultValue={editingBook.publication_year}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-category_id">Category *</Label>
                    <Select value={editCategoryId} onValueChange={setEditCategoryId} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-total_copies">Total Copies *</Label>
                    <Input
                      id="edit-total_copies"
                      name="total_copies"
                      type="number"
                      min="1"
                      defaultValue={editingBook.total_copies}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-available_copies">Available Copies *</Label>
                    <Input
                      id="edit-available_copies"
                      name="available_copies"
                      type="number"
                      min="0"
                      defaultValue={editingBook.available_copies}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea id="edit-description" name="description" rows={3} defaultValue={editingBook.description} />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">Update Book</Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      setDeleteBookId(editingBook.id);
                      setIsEditDialogOpen(false);
                    }}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteBookId} onOpenChange={() => setDeleteBookId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the book from the catalog.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteBook} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title or author..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBooks.map((book) => (
            <Card key={book.id} className="overflow-hidden transition-all hover:shadow-lg">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="line-clamp-2 mb-1">{book.title}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {book.author}
                    </CardDescription>
                  </div>
                  <Badge variant={book.available_copies > 0 ? "default" : "destructive"}>
                    {book.available_copies > 0 ? "Available" : "Out of Stock"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {book.description || "No description available"}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <BookOpen className="h-4 w-4" />
                      <span>{book.available_copies}/{book.total_copies} copies</span>
                    </div>
                    {book.publication_year && (
                      <span className="text-xs">© {book.publication_year}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {canManageBooks && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(book)}
                        className="gap-1"
                      >
                        <Edit className="h-3 w-3" />
                        Edit
                      </Button>
                    )}
                    {user && !canManageBooks && book.available_copies > 0 && (
                      <Button
                        size="icon"
                        onClick={() => handleAddToMyBooks(book.id)}
                        title="Add to My Books"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredBooks.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No books found</p>
          </div>
        )}
      </div>
    </div>
  );
}