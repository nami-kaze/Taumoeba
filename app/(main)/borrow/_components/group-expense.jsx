import React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createGroup, getGroups, addGroupExpense, settleSplit, deleteGroupExpense, updateGroupExpense, deleteGroup } from "@/actions/debts";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserPlus, Trash2, Edit2, Check, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";
  
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
  } from "@/components/ui/dialog"


export function GroupExpense () {

    // New states for group expenses
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: "",
    description: "",
    members: []
  });
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [newExpense, setNewExpense] = useState({
    description: "",
    amount: "",
    paidBy: "",
    paidByName: "",
    splitType: "equal", // equal, percentage, exact
    splits: []
  });
  const [newMember, setNewMember] = useState("");

  // Add this state near your other states
  const [fadingSettlements, setFadingSettlements] = useState(new Set());

  // Add these new state variables near your other state declarations (around line 50)
  const [editingExpense, setEditingExpense] = useState(null);
  const [showEditExpenseForm, setShowEditExpenseForm] = useState(false);

  // Add these near your other state declarations
  const [showEditGroupForm, setShowEditGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);

  // Add these new states after your existing state declarations
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all"); // "all", "paid", "received"
  const [filterMember, setFilterMember] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest"); // "newest", "oldest", "amount-high", "amount-low"
  const ITEMS_PER_PAGE = 5;

  // First, let's modify the calculateSplits function to ensure it always returns properly formatted data
  const calculateSplits = (amount, splitType, splits, members) => {
    if (!amount || !members?.length) return [];

    if (splitType === "equal") {
      const equalShare = parseFloat(amount) / members.length;
      return members.map(member => ({
        id: member.id,
        name: member.name,
        amount: parseFloat(equalShare.toFixed(2)) // Round to 2 decimal places
      }));
    }

    if (splitType === "percentage") {
      return splits.map(split => ({
        id: split.id,
        name: members.find(m => m.id === split.id)?.name,
        amount: parseFloat(((parseFloat(amount) * parseFloat(split.value)) / 100).toFixed(2))
      }));
    }

    // For exact amounts
    return splits.map(split => ({
      id: split.id,
      name: members.find(m => m.id === split.id)?.name,
      amount: parseFloat(parseFloat(split.value).toFixed(2))
    }));
  };

  useEffect(() => {
    fetchGroups();
  }, []);
  
  // First, modify the fetchGroups function to update activeGroup
  const fetchGroups = async () => {
    try {
      const response = await getGroups();
      if (response.success) {
        setGroups(response.groups);
        // If there's an active group, update it with the new data
        if (activeGroup) {
          const updatedActiveGroup = response.groups.find(g => g.id === activeGroup.id);
          if (updatedActiveGroup) {
            setActiveGroup(updatedActiveGroup);
          }
        }
      } else {
        toast.error(response.error || "Failed to fetch groups");
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
      toast.error("An error occurred while fetching groups");
    }
  };
  
  // First, add this helper function to recalculate balances when a settlement is deleted
  const deleteSettlement = (settlement, group) => {
    // Create updated members array with adjusted balances
    const updatedMembers = group.members.map(member => {
      let newBalance = member.balance || 0;
      
      // Add back the settled amount to the person who paid (debtor)
      if (member.name === settlement.from) {
        newBalance -= settlement.amount;
      }
      // Subtract the settled amount from the person who received (creditor)
      if (member.name === settlement.to) {
        newBalance += settlement.amount;
      }
      
      return {
        ...member,
        balance: newBalance
      };
    });

    // Create updated group with new balances and recalculated settlements
    const updatedGroup = {
      ...group,
      members: updatedMembers,
      settlements: calculateSettlements(updatedMembers) // Recalculate remaining settlements
    };

    return updatedGroup;
  };

  // Add this helper function to handle automatic settlements
  const handleAutoSettlements = async (expenses) => {
    try {
      // Create a map of reciprocal splits
      const reciprocalSplits = new Map();

      // Find reciprocal splits that can be auto-settled
      expenses.forEach(expense1 => {
        expense1.splits.forEach(split1 => {
          if (split1.isSettled) return; // Skip already settled splits

          // Look for reciprocal splits in other expenses
          expenses.forEach(expense2 => {
            if (expense1.id === expense2.id) return; // Skip same expense

            expense2.splits.forEach(split2 => {
              if (split2.isSettled) return; // Skip already settled splits

              // Check if these splits cancel each other out
              if (
                split1.memberId === expense2.paidById && // member1 paid expense2
                split2.memberId === expense1.paidById && // member2 paid expense1
                Math.abs(split1.amount - split2.amount) < 0.01 // amounts are equal
              ) {
                const key = [split1.id, split2.id].sort().join('-');
                reciprocalSplits.set(key, { split1, split2 });
              }
            });
          });
        });
      });

      // Settle all reciprocal splits
      const settlementPromises = [];
      for (const { split1, split2 } of reciprocalSplits.values()) {
        settlementPromises.push(
          settleSplit(split1.id),
          settleSplit(split2.id)
        );
      }

      if (settlementPromises.length > 0) {
        const results = await Promise.all(settlementPromises);
        const allSuccessful = results.every(r => r.success);
        
        if (allSuccessful) {
          return true;
        } else {
          console.error("Some automatic settlements failed");
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error("Error in automatic settlements:", error);
      return false;
    }
  };

  // Add these functions before the return statement
  const getFilteredExpenses = () => {
    if (!activeGroup?.expenses) return [];
    let expenses = [...activeGroup.expenses];
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      expenses = expenses.filter(exp => 
        exp.description.toLowerCase().includes(term) ||
        exp.paidByName.toLowerCase().includes(term)
      );
    }
    
    // Apply member filter
    if (filterMember !== "all") {
      expenses = expenses.filter(exp => 
        exp.paidById === filterMember || 
        exp.splits.some(split => split.memberId === filterMember)
      );
    }
    
    // Apply type filter
    if (filterType === "paid") {
      expenses = expenses.filter(exp => exp.paidById === activeGroup.currentUserId);
    } else if (filterType === "received") {
      expenses = expenses.filter(exp => 
        exp.splits.some(split => split.memberId === activeGroup.currentUserId)
      );
    }
    
    // Apply sorting
    expenses.sort((a, b) => {
      switch (sortOrder) {
        case "oldest":
          return new Date(a.createdAt) - new Date(b.createdAt);
        case "amount-high":
          return b.amount - a.amount;
        case "amount-low":
          return a.amount - b.amount;
        case "newest":
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });
    
    return expenses;
  };

  const getPaginatedExpenses = () => {
    const filtered = getFilteredExpenses();
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  };

  // Calculate total pages
  const totalPages = Math.ceil(getFilteredExpenses().length / ITEMS_PER_PAGE);

  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Add this with your other useEffect hooks
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterMember, sortOrder]);

  return (
    <div>
        <TabsContent value="groups">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-4xl font-bold tracking-tight gradient-title">
                Group Expenses
              </h1>
              <Button onClick={() => setShowGroupForm(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Create New Group
              </Button>
            </div>

            {/* Groups Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group) => (
                <Card
                  key={group.id}
                  className="cursor-pointer hover:border-primary relative"
                  onClick={() => setActiveGroup(group)}
                >
                  <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                      <span>{group.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {group.members.length} members
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex -space-x-2">
                      {group.members.slice(0, 4).map((member) => (
                        <Avatar key={member.id} className="border-2 border-background">
                          <AvatarFallback>
                            {member.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {group.members.length > 4 && (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm">
                          +{group.members.length - 4}
                        </div>
                      )}
                    </div>
                  </CardContent>
                  {/* Add bottom actions bar */}
                  <div 
                    className="absolute bottom-2 right-2 flex gap-2"
                    onClick={(e) => e.stopPropagation()} // Prevent card click when clicking buttons
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingGroup({
                          ...group,
                          members: group.members.map(m => ({
                            id: m.id,
                            name: m.name
                          }))
                        });
                        setShowEditGroupForm(true);
                      }}
                      title="Edit group"
                    >
                      <Edit2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (confirm("Are you sure you want to delete this group? This will delete all expenses and cannot be undone.")) {
                          const response = await deleteGroup(group.id);
                          if (response.success) {
                            toast.success("Group deleted successfully");
                            await fetchGroups();
                            if (activeGroup?.id === group.id) {
                              setActiveGroup(null);
                            }
                          } else {
                            toast.error(response.error || "Failed to delete group");
                          }
                        }
                      }}
                      title="Delete group"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {/* Active Group View */}
            {activeGroup && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    <span>{activeGroup.name}</span>
                    <Button onClick={() => setShowExpenseForm(true)}>
                      Add Expense
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="expenses">
                    <TabsList>
                      <TabsTrigger value="expenses">Expenses</TabsTrigger>
                      <TabsTrigger value="settlements">Settlements</TabsTrigger>
                    </TabsList>

                    <TabsContent value="expenses">
                      {/* Filters */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        {/* Search */}
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search expenses"
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                        
                        {/* Member Filter */}
                        <Select value={filterMember} onValueChange={setFilterMember}>
                          <SelectTrigger>
                            <SelectValue placeholder="Filter by member" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Members</SelectItem>
                            {activeGroup?.members.map(member => (
                              <SelectItem key={member.id} value={member.id}>
                                {member.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        {/* Type Filter */}
                        <Select value={filterType} onValueChange={setFilterType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Filter by type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Expenses</SelectItem>
                            <SelectItem value="paid">Paid by me</SelectItem>
                            <SelectItem value="received">Shared with me</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        {/* Sort Order */}
                        <Select value={sortOrder} onValueChange={setSortOrder}>
                          <SelectTrigger>
                            <SelectValue placeholder="Sort by" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="newest">Newest First</SelectItem>
                            <SelectItem value="oldest">Oldest First</SelectItem>
                            <SelectItem value="amount-high">Amount (High to Low)</SelectItem>
                            <SelectItem value="amount-low">Amount (Low to High)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Expenses list */}
                      <div className="space-y-4">
                        {getPaginatedExpenses().map((expense) => (
                          <div
                            key={expense.id}
                            className="flex justify-between items-center p-3 bg-muted rounded-lg"
                          >
                            <div>
                              <p className="font-medium">{expense.description}</p>
                              <p className="text-sm text-muted-foreground">
                                Paid by {expense.paidByName}
                              </p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="font-semibold">₹{expense.amount}</p>
                              </div>
                              <div className="flex gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => {
                                    setEditingExpense({
                                      ...expense,
                                      splitType: "exact", // Since we have the exact amounts
                                      splits: expense.splits.map(split => ({
                                        id: split.memberId,
                                        value: split.amount.toString()
                                      }))
                                    });
                                    setShowEditExpenseForm(true);
                                  }}
                                  title="Edit expense"
                                >
                                  <Edit2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={async () => {
                                    if (confirm("Are you sure you want to delete this expense?")) {
                                      const response = await deleteGroupExpense(expense.id);
                                      if (response.success) {
                                        toast.success("Expense deleted successfully");
                                        await fetchGroups();
                                      } else {
                                        toast.error(response.error || "Failed to delete expense");
                                      }
                                    }
                                  }}
                                  title="Delete expense"
                                >
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {/* No Results Message */}
                        {getFilteredExpenses().length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            No expenses found matching your filters.
                          </div>
                        )}
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-6">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-sm">
                            Page {currentPage} of {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="settlements">
                      <div className="space-y-4">
                        {activeGroup.settlements?.length > 0 ? (
                          activeGroup.settlements.map((settlement, index) => {
                            // Find only unsettled splits between these members
                            const relevantSplits = [];
                            let totalUnsettledAmount = 0;

                            // First, get all expenses where 'to' member paid
                            const expensesFromPayer = activeGroup.expenses.filter(exp => 
                              exp.paidById === settlement.to.id
                            );

                            // For each expense, check splits for 'from' member
                            expensesFromPayer.forEach(exp => {
                              const unsettledSplits = exp.splits.filter(split => 
                                split.memberId === settlement.from.id && 
                                !split.isSettled // Only include splits that haven't been settled
                              );

                              unsettledSplits.forEach(split => {
                                relevantSplits.push({
                                  ...split,
                                  expenseId: exp.id
                                });
                                totalUnsettledAmount += Number(split.amount);
                              });
                            });

                            // Don't render if there are no unsettled splits or amount is 0
                            if (relevantSplits.length === 0 || totalUnsettledAmount === 0) return null;

                            return (
                              <div
                                key={`${settlement.from.id}-${settlement.to.id}-${totalUnsettledAmount}`}
                                className={`flex items-center justify-between p-4 bg-muted rounded-lg transition-all duration-500 ${
                                  fadingSettlements.has(index) ? 'opacity-0 transform scale-95 h-0 m-0 p-0 overflow-hidden' : 'opacity-100 transform scale-100'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback>
                                      {settlement.from.name.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{settlement.from.name}</span>
                                    <span className="text-sm text-muted-foreground">needs to pay</span>
                                  </div>
                                </div>
                                <div className="font-semibold text-lg">
                                  ₹{totalUnsettledAmount.toFixed(2)}
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-2">
                                    <div className="flex flex-col items-end">
                                      <span className="font-medium">{settlement.to.name}</span>
                                      <span className="text-sm text-muted-foreground">will receive</span>
                                    </div>
                                    <Avatar className="h-8 w-8">
                                      <AvatarFallback>
                                        {settlement.to.name.substring(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      try {
                                        setFadingSettlements(prev => new Set([...prev, index]));

                                        // Settle only the unsettled splits
                                        const results = await Promise.all(
                                          relevantSplits.map(split => settleSplit(split.id))
                                        );

                                        if (results.every(r => r.success)) {
                                          // Update expenses locally
                                          const updatedExpenses = activeGroup.expenses.map(exp => ({
                                            ...exp,
                                            splits: exp.splits.map(split => {
                                              if (relevantSplits.some(rs => rs.id === split.id)) {
                                                return { ...split, isSettled: true };
                                              }
                                              return split;
                                            })
                                          }));

                                          setActiveGroup({
                                            ...activeGroup,
                                            expenses: updatedExpenses
                                          });

                                          setTimeout(async () => {
                                            await fetchGroups();
                                            setFadingSettlements(new Set());
                                            toast.success('Settlement completed successfully!');
                                          }, 500);
                                        } else {
                                          setFadingSettlements(new Set());
                                          toast.error("Failed to process settlement");
                                        }
                                      } catch (error) {
                                        console.error("Error settling:", error);
                                        setFadingSettlements(new Set());
                                        toast.error("An error occurred while settling");
                                      }
                                    }}
                                    className="flex items-center gap-1"
                                  >
                                    <Check className="h-4 w-4" />
                                    <span>Settle</span>
                                  </Button>
                                </div>
                              </div>
                            );
                          }).filter(Boolean)
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            No settlements pending. All settled.
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

         {/* Create Group Modal */}
      <Dialog open={showGroupForm} onOpenChange={setShowGroupForm}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
            <DialogDescription>
              Create a new group to split expenses with friends
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault()
            // Validate form data
            if (!newGroup.name.trim()) {
              toast.error("Group name is required");
              return;
            }
            if (newGroup.members.length < 2) {
              toast.error("Add at least 2 members to create a group");
              return;
            }

            try {
              // Format the group data properly
              const groupData = {
                name: newGroup.name.trim(),
                description: newGroup.description || "",
                members: newGroup.members.map(member => ({
                  name: member.name.trim()
                }))
              };
              console.log("Sending group data:", groupData); 
              const response = await createGroup(groupData);

              if (response.success) {
                toast.success("Group created successfully!");
                fetchGroups(); // Refresh groups list
                setNewGroup({ name: "", description: "", members: [] });
                setShowGroupForm(false);
              } else {
                toast.error(response.error || "Failed to create group");
              }
            } catch (error) {
              console.error("Error creating group:", error);
              toast.error("An error occurred while creating the group");
            }
          }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Group Name</label>
                <Input
                  placeholder="Enter group name"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  placeholder="Enter group description"
                  value={newGroup.description}
                  onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Add Members</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter member name"
                    value={newMember}
                    onChange={(e) => setNewMember(e.target.value)}
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      if (newMember.trim()) {
                        setNewGroup({
                          ...newGroup,
                          members: [...newGroup.members, { id: Date.now().toString(), name: newMember.trim() }]
                        });
                        setNewMember("");
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Member List */}
              <div className="space-y-2">
                {newGroup.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span>{member.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setNewGroup({
                          ...newGroup,
                          members: newGroup.members.filter(m => m.id !== member.id)
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Create Group</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>


      {/* Edit Group Modal */}
      <Dialog open={showEditGroupForm} onOpenChange={setShowEditGroupForm}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
            <DialogDescription>
              Update group details and members
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            // Validate form data
            if (!editingGroup?.name.trim()) {
              toast.error("Group name is required");
              return;
            }
            if (editingGroup?.members.length < 2) {
              toast.error("Group must have at least 2 members");
              return;
            }

            try {
              const groupData = {
                name: editingGroup.name.trim(),
                description: editingGroup.description || "",
                members: editingGroup.members.map(member => ({
                  id: member.id,
                  name: member.name.trim()
                }))
              };

              const response = await updateGroup(editingGroup.id, groupData);

              if (response.success) {
                toast.success("Group updated successfully!");
                await fetchGroups();
                setShowEditGroupForm(false);
                setEditingGroup(null);
              } else {
                toast.error(response.error || "Failed to update group");
              }
            } catch (error) {
              console.error("Error updating group:", error);
              toast.error("An error occurred while updating the group");
            }
          }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Group Name</label>
                <Input
                  placeholder="Enter group name"
                  value={editingGroup?.name || ""}
                  onChange={(e) => setEditingGroup({ 
                    ...editingGroup, 
                    name: e.target.value 
                  })}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  placeholder="Enter group description"
                  value={editingGroup?.description || ""}
                  onChange={(e) => setEditingGroup({ 
                    ...editingGroup, 
                    description: e.target.value 
                  })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Add Members</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter member name"
                    value={newMember}
                    onChange={(e) => setNewMember(e.target.value)}
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      if (newMember.trim()) {
                        setEditingGroup({
                          ...editingGroup,
                          members: [...(editingGroup?.members || []), 
                            { 
                              id: Date.now().toString(), 
                              name: newMember.trim() 
                            }
                          ]
                        });
                        setNewMember("");
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Member List */}
              <div className="space-y-2">
                {editingGroup?.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span>{member.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingGroup({
                          ...editingGroup,
                          members: editingGroup.members.filter(m => m.id !== member.id)
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

         {/* Add Expense Modal */}
         <Dialog open={showExpenseForm} onOpenChange={setShowExpenseForm}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Expense</DialogTitle>
            <DialogDescription>
              Add a new expense to split with group members
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              // Validate required fields
              if (!newExpense.description || !newExpense.amount || !newExpense.paidBy) {
                toast.error("Please fill in all required fields");
                return;
              }

              // Calculate splits before making the request
              const calculatedSplits = calculateSplits(
                parseFloat(newExpense.amount),
                newExpense.splitType,
                newExpense.splits,
                activeGroup.members
              );

              // Validate that splits were calculated
              if (!calculatedSplits.length) {
                toast.error("Failed to calculate splits");
                return;
              }

              const expenseData = {
                description: newExpense.description,
                amount: parseFloat(newExpense.amount),
                paidBy: newExpense.paidBy,
                splits: calculatedSplits,
                createdAt: new Date().toISOString(),
              };

              console.log("Sending expense data:", expenseData);

              const response = await addGroupExpense(activeGroup.id, expenseData);

              if (response.success) {
                // After adding the expense, handle automatic settlements
                const updatedGroup = await getGroups().then(r => 
                  r.groups.find(g => g.id === activeGroup.id)
                );
                
                if (updatedGroup) {
                  // Process automatic settlements
                  await handleAutoSettlements(updatedGroup.expenses);
                }

                toast.success("Expense added successfully!");
                await fetchGroups(); // Refresh the data
                setNewExpense({
                  description: "",
                  amount: "",
                  paidBy: "",
                  paidByName: "",
                  splitType: "equal",
                  splits: [],
                  createdAt: new Date().toISOString(),
                });
                setShowExpenseForm(false);
              } else {
                toast.error(response.error || "Failed to add expense");
              }
            } catch (error) {
              console.error("Error adding expense:", error);
              toast.error("An error occurred while adding the expense");
            }
          }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  placeholder="What was this expense for?"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Amount</label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Paid By</label>
                <Select
                  value={newExpense.paidBy}
                  onValueChange={(value) => {
                    const selectedMember = activeGroup.members.find(m => m.id === value);
                    setNewExpense({
                      ...newExpense,
                      paidBy: value,
                      paidByName: selectedMember?.name
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Who paid?" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeGroup?.members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Split Type</label>
                <Select
                  value={newExpense.splitType}
                  onValueChange={(value) => setNewExpense({ ...newExpense, splitType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="How to split?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equal">Split Equally</SelectItem>
                    <SelectItem value="percentage">Split by Percentage</SelectItem>
                    <SelectItem value="exact">Split by Exact Amounts</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Split Details */}
              {newExpense.splitType !== "equal" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Split Details</label>
                  {activeGroup?.members.map((member) => (
                    <div key={member.id} className="flex items-center gap-2">
                      <span className="w-1/3">{member.name}</span>
                      <Input
                        type="number"
                        placeholder={newExpense.splitType === "percentage" ? "%" : "Amount"}
                        value={newExpense.splits.find(s => s.id === member.id)?.value || ""}
                        onChange={(e) => {
                          const newSplits = [...newExpense.splits];
                          const index = newSplits.findIndex(s => s.id === member.id);
                          if (index >= 0) {
                            newSplits[index].value = e.target.value;
                          } else {
                            newSplits.push({ id: member.id, value: e.target.value });
                          }
                          setNewExpense({ ...newExpense, splits: newSplits });
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="submit">Add Expense</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Expense Modal */}  {/* Edit Expense Modal */}
      <Dialog open={showEditExpenseForm} onOpenChange={setShowEditExpenseForm}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>
              Update expense details
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              if (!editingExpense?.description || !editingExpense?.amount || !editingExpense?.paidBy) {
                toast.error("Please fill in all required fields");
                return;
              }

              const calculatedSplits = calculateSplits(
                parseFloat(editingExpense.amount),
                editingExpense.splitType,
                editingExpense.splits,
                activeGroup.members
              );

              if (!calculatedSplits.length) {
                toast.error("Failed to calculate splits");
                return;
              }

              const response = await updateGroupExpense(editingExpense.id, {
                description: editingExpense.description,
                amount: parseFloat(editingExpense.amount),
                paidBy: editingExpense.paidBy,
                splits: calculatedSplits
              });

              if (response.success) {
                toast.success("Expense updated successfully!");
                await fetchGroups();
                setShowEditExpenseForm(false);
                setEditingExpense(null);
              } else {
                toast.error(response.error || "Failed to update expense");
              }
            } catch (error) {
              console.error("Error updating expense:", error);
              toast.error("An error occurred while updating the expense");
            }
          }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  placeholder="What was this expense for?"
                  value={editingExpense?.description || ""}
                  onChange={(e) => setEditingExpense({ 
                    ...editingExpense, 
                    description: e.target.value 
                  })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Amount</label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={editingExpense?.amount || ""}
                  onChange={(e) => setEditingExpense({ 
                    ...editingExpense, 
                    amount: e.target.value 
                  })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Paid By</label>
                <Select
                  value={editingExpense?.paidBy || ""}
                  onValueChange={(value) => {
                    const selectedMember = activeGroup.members.find(m => m.id === value);
                    setEditingExpense({
                      ...editingExpense,
                      paidBy: value,
                      paidByName: selectedMember?.name
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Who paid?" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeGroup?.members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Split Details</label>
                {activeGroup?.members.map((member) => (
                  <div key={member.id} className="flex items-center gap-2">
                    <span className="w-1/3">{member.name}</span>
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={editingExpense?.splits.find(s => s.id === member.id)?.value || ""}
                      onChange={(e) => {
                        const newSplits = [...(editingExpense?.splits || [])];
                        const index = newSplits.findIndex(s => s.id === member.id);
                        if (index >= 0) {
                          newSplits[index].value = e.target.value;
                        } else {
                          newSplits.push({ id: member.id, value: e.target.value });
                        }
                        setEditingExpense({ ...editingExpense, splits: newSplits });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default GroupExpense
