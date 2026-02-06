import { useState, useRef } from 'react';
import { Dialog } from '@base-ui-components/react/dialog';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import type { TagCategory, TagSubcategory } from '../../types';
import {
  X, FolderPlus, FilePlus, Plus, Trash2, Edit2, Check,
  ChevronRight, ChevronDown, Download, Upload, Tag,
  GripVertical, ArrowUp, ArrowDown
} from 'lucide-react';
import { useTagStore } from '../../stores/tagStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '../ui';

export function TagManagerModal() {
  const { t } = useTranslation();
  const theme = useSettingsStore(state => state.theme);
  const {
    categories, isModalOpen, closeModal,
    addCategory, renameCategory, deleteCategory, toggleCategoryExpand,
    addSubcategory, renameSubcategory, deleteSubcategory,
    addTag, removeTag, importLibrary, exportLibrary,
    reorderCategories, reorderSubcategories, reorderTags
  } = useTagStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubName, setNewSubName] = useState<{ catId: string; value: string } | null>(null);
  const [newTagInput, setNewTagInput] = useState<{ catId: string; subId: string; value: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const json = exportLibrary();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TagFusion_Tags_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const json = ev.target?.result as string;
      if (importLibrary(json)) {
        alert(t('tagManager.importSuccess', 'Import successful!'));
      } else {
        alert(t('tagManager.importFailed', 'Import failed!'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const startEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditValue(currentName);
  };

  const confirmEdit = (type: 'category' | 'subcategory', catId: string, subId?: string) => {
    if (!editValue.trim()) return;
    if (type === 'category') {
      renameCategory(catId, editValue.trim());
    } else if (subId) {
      renameSubcategory(catId, subId, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  };

  const onDragEnd = (result: DropResult) => {
    const { source, destination, type } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    if (type === 'CATEGORY') {
      reorderCategories(source.index, destination.index);
    } else if (type === 'SUBCATEGORY') {
      const categoryId = source.droppableId.replace('subs-', '');
      reorderSubcategories(categoryId, source.index, destination.index);
    } else if (type === 'TAG') {
      const [catId, subId] = source.droppableId.replace('tags-', '').split(':');
      reorderTags(catId, subId, source.index, destination.index);
    }
  };

  return (
    <Dialog.Root open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[800px] max-h-[80vh] rounded-2xl overflow-hidden flex flex-col transition-all data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 glass-card"
          style={{
            background: theme === 'dark'
              ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)'
              : 'linear-gradient(135deg, rgba(248, 250, 252, 0.95) 0%, rgba(241, 245, 249, 0.95) 100%)',
            border: theme === 'dark'
              ? '1px solid rgba(6, 182, 212, 0.20)'
              : '1px solid rgba(8, 145, 178, 0.20)',
            boxShadow: theme === 'dark'
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(6, 182, 212, 0.1)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          }}
        >
          {/* Glass Specular Highlight */}
          <div
            className="absolute inset-x-0 top-0 h-[1px] z-10"
            style={{
              background: theme === 'dark'
                ? 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)'
                : 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.05) 50%, transparent 100%)'
            }}
          />
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-cyan-500/20">
            <div className="flex items-center gap-3">
              <Tag className="text-cyan-600 dark:text-cyan-400" size={24} />
              <Dialog.Title className="text-xl font-semibold text-slate-900 dark:text-white">{t('tagManager.title')}</Dialog.Title>
            </div>
            <div className="flex items-center gap-2">
              <input type="file" ref={fileInputRef} accept=".json" onChange={handleImport} className="hidden" />
              <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload size={16} /> {t('tagManager.import')}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleExport}>
                <Download size={16} /> {t('tagManager.export')}
              </Button>
              <Dialog.Close className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X size={20} className="text-slate-400" />
              </Dialog.Close>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Add Category */}
            <div className="flex gap-2 mb-4">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={t('tagManager.newCategory')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCategoryName.trim()) {
                    addCategory(newCategoryName.trim());
                    setNewCategoryName('');
                  }
                }}
              />
              <Button
                variant="primary"
                onClick={() => {
                  if (newCategoryName.trim()) {
                    addCategory(newCategoryName.trim());
                    setNewCategoryName('');
                  }
                }}
              >
                <FolderPlus size={18} />
              </Button>
            </div>

            {/* DragDropContext for entire tree */}
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="categories-root" type="CATEGORY">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-2"
                  >
                    {categories.map((cat, index) => (
                      <CategoryItem
                        key={cat.id}
                        category={cat}
                        index={index}
                        isFirst={index === 0}
                        isLast={index === categories.length - 1}
                        editingId={editingId}
                        editValue={editValue}
                        setEditValue={setEditValue}
                        startEdit={startEdit}
                        confirmEdit={confirmEdit}
                        setEditingId={setEditingId}
                        newSubName={newSubName}
                        setNewSubName={setNewSubName}
                        newTagInput={newTagInput}
                        setNewTagInput={setNewTagInput}
                        toggleCategoryExpand={toggleCategoryExpand}
                        deleteCategory={deleteCategory}
                        reorderCategories={reorderCategories}
                        addSubcategory={addSubcategory}
                        renameSubcategory={renameSubcategory}
                        deleteSubcategory={deleteSubcategory}
                        reorderSubcategories={reorderSubcategories}
                        addTag={addTag}
                        removeTag={removeTag}
                      />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Category Item Component
interface CategoryItemProps {
  category: TagCategory;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  editingId: string | null;
  editValue: string;
  setEditValue: (v: string) => void;
  startEdit: (id: string, name: string) => void;
  confirmEdit: (type: 'category' | 'subcategory', catId: string, subId?: string) => void;
  setEditingId: (id: string | null) => void;
  newSubName: { catId: string; value: string } | null;
  setNewSubName: (v: { catId: string; value: string } | null) => void;
  newTagInput: { catId: string; subId: string; value: string } | null;
  setNewTagInput: (v: { catId: string; subId: string; value: string } | null) => void;
  toggleCategoryExpand: (id: string) => void;
  deleteCategory: (id: string) => void;
  reorderCategories: (s: number, e: number) => void;
  addSubcategory: (catId: string, name: string) => void;
  renameSubcategory: (catId: string, subId: string, name: string) => void;
  deleteSubcategory: (catId: string, subId: string) => void;
  reorderSubcategories: (catId: string, s: number, e: number) => void;
  addTag: (catId: string, subId: string, tag: string) => void;
  removeTag: (catId: string, subId: string, tag: string) => void;
}

function CategoryItem({
  category: cat, index, isFirst, isLast, editingId, editValue, setEditValue, startEdit, confirmEdit, setEditingId,
  newSubName, setNewSubName, newTagInput, setNewTagInput,
  toggleCategoryExpand, deleteCategory, reorderCategories,
  addSubcategory, deleteSubcategory, reorderSubcategories, addTag, removeTag
}: CategoryItemProps) {
  const { t } = useTranslation();
  const theme = useSettingsStore(state => state.theme);

  return (
    <Draggable draggableId={cat.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`rounded-xl overflow-hidden transition-shadow ${snapshot.isDragging ? 'shadow-2xl ring-2 ring-cyan-500/50' : ''}`}
          style={{
            ...provided.draggableProps.style,
            background: snapshot.isDragging
              ? (theme === 'dark' ? 'rgba(30, 41, 59, 0.95)' : 'rgba(241, 245, 249, 0.95)')
              : (theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)')
          }}
        >
          {/* Category Header */}
          <div className="flex items-center gap-2 p-3 hover:bg-black/5 dark:hover:bg-white/5 group">
            <div {...provided.dragHandleProps} className="p-1 cursor-grab active:cursor-grabbing text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical size={16} />
            </div>

            <button onClick={() => toggleCategoryExpand(cat.id)} className="p-1">
              {cat.isExpanded ? <ChevronDown size={16} className="text-cyan-600 dark:text-cyan-400" /> : <ChevronRight size={16} className="text-slate-500 dark:text-slate-400" />}
            </button>
            {editingId === cat.id ? (
              <div className="flex-1 flex gap-2">
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && confirmEdit('category', cat.id)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-sm text-slate-900 dark:text-white border border-cyan-500/30"
                />
                <button onClick={() => confirmEdit('category', cat.id)} className="text-green-400"><Check size={16} /></button>
                <button onClick={() => setEditingId(null)} className="text-slate-400"><X size={16} /></button>
              </div>
            ) : (
              <>
                <span className="flex-1 font-medium text-slate-900 dark:text-white">{cat.name}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    disabled={isFirst}
                    onClick={() => reorderCategories(index, index - 1)}
                    className={`p-1 ${isFirst ? 'text-slate-300 dark:text-slate-700' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    disabled={isLast}
                    onClick={() => reorderCategories(index, index + 1)}
                    className={`p-1 ${isLast ? 'text-slate-300 dark:text-slate-700' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
                <button onClick={() => startEdit(cat.id, cat.name)} className="p-1 opacity-40 hover:opacity-100 text-slate-700 dark:text-slate-200"><Edit2 size={14} /></button>
                <button onClick={() => setNewSubName({ catId: cat.id, value: '' })} className="p-1 opacity-40 hover:opacity-100 text-cyan-600 dark:text-cyan-400"><FilePlus size={14} /></button>
                <button onClick={() => deleteCategory(cat.id)} className="p-1 opacity-40 hover:opacity-100 text-red-500"><Trash2 size={14} /></button>
              </>
            )}
          </div>

          {/* Subcategories Droppable */}
          {cat.isExpanded && (
            <Droppable droppableId={`subs-${cat.id}`} type="SUBCATEGORY">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="pl-6 pb-2 min-h-[32px]"
                >
                  {newSubName && newSubName.catId === cat.id && (
                    <div className="flex gap-2 p-2">
                      <input
                        autoFocus
                        value={newSubName.value}
                        onChange={(e) => setNewSubName({ catId: newSubName.catId, value: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newSubName.value.trim()) {
                            addSubcategory(cat.id, newSubName.value.trim());
                            setNewSubName(null);
                          } else if (e.key === 'Escape') setNewSubName(null);
                        }}
                        placeholder={t('tagManager.newSubcategory')}
                        className="flex-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-sm text-slate-900 dark:text-white border border-cyan-500/30"
                      />
                    </div>
                  )}
                  {cat.subcategories.map((sub: TagSubcategory, subIndex) => (
                    <SubcategoryItem
                      key={sub.id}
                      sub={sub}
                      index={subIndex}
                      isFirst={subIndex === 0}
                      isLast={subIndex === cat.subcategories.length - 1}
                      catId={cat.id}
                      editingId={editingId}
                      editValue={editValue}
                      setEditValue={setEditValue}
                      startEdit={startEdit}
                      confirmEdit={confirmEdit}
                      setEditingId={setEditingId}
                      newTagInput={newTagInput}
                      setNewTagInput={setNewTagInput}
                      deleteSubcategory={deleteSubcategory}
                      reorderSubcategories={reorderSubcategories}
                      addTag={addTag}
                      removeTag={removeTag}
                    />
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          )}
        </div>
      )}
    </Draggable>
  );
}

// Subcategory Item Component
function SubcategoryItem({
  sub, index, isFirst, isLast, catId, editingId, editValue, setEditValue, startEdit, confirmEdit, setEditingId,
  newTagInput, setNewTagInput, deleteSubcategory, reorderSubcategories, addTag, removeTag
}: {
  sub: TagSubcategory;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  catId: string;
  editingId: string | null;
  editValue: string;
  setEditValue: (v: string) => void;
  startEdit: (id: string, name: string) => void;
  confirmEdit: (type: 'category' | 'subcategory', catId: string, subId?: string) => void;
  setEditingId: (id: string | null) => void;
  newTagInput: { catId: string; subId: string; value: string } | null;
  setNewTagInput: (v: { catId: string; subId: string; value: string } | null) => void;
  deleteSubcategory: (catId: string, subId: string) => void;
  reorderSubcategories: (catId: string, s: number, e: number) => void;
  addTag: (catId: string, subId: string, tag: string) => void;
  removeTag: (catId: string, subId: string, tag: string) => void;
}) {
  const { t } = useTranslation();
  const theme = useSettingsStore(state => state.theme);

  return (
    <Draggable draggableId={sub.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`mb-2 rounded-lg transition-colors ${snapshot.isDragging ? 'bg-cyan-500/10 ring-1 ring-cyan-500/30' : ''}`}
        >
          <div className="flex items-center gap-2 p-2 group">
            <div {...provided.dragHandleProps} className="p-1 cursor-grab active:cursor-grabbing text-slate-500 dark:text-slate-600 hover:text-cyan-600 dark:hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical size={14} />
            </div>

            {editingId === sub.id ? (
              <div className="flex-1 flex gap-2">
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && confirmEdit('subcategory', catId, sub.id)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-sm text-slate-900 dark:text-white border border-cyan-500/30"
                />
                <button onClick={() => confirmEdit('subcategory', catId, sub.id)} className="text-green-600 dark:text-green-400"><Check size={16} /></button>
                <button onClick={() => setEditingId(null)} className="text-slate-500 dark:text-slate-400"><X size={16} /></button>
              </div>
            ) : (
              <>
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{sub.name}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    disabled={isFirst}
                    onClick={() => reorderSubcategories(catId, index, index - 1)}
                    className={`p-1 ${isFirst ? 'text-slate-300 dark:text-slate-800' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    disabled={isLast}
                    onClick={() => reorderSubcategories(catId, index, index + 1)}
                    className={`p-1 ${isLast ? 'text-slate-300 dark:text-slate-800' : 'text-slate-500 hover:text-white'}`}
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>
                <button onClick={() => startEdit(sub.id, sub.name)} className="p-1 opacity-40 hover:opacity-100 text-slate-700 dark:text-slate-200"><Edit2 size={12} /></button>
                <button onClick={() => setNewTagInput({ catId, subId: sub.id, value: '' })} className="p-1 opacity-40 hover:opacity-100 text-cyan-600 dark:text-cyan-400"><Plus size={12} /></button>
                <button onClick={() => deleteSubcategory(catId, sub.id)} className="p-1 opacity-40 hover:opacity-100 text-red-500"><Trash2 size={12} /></button>
              </>
            )}
          </div>

          {/* Add Tag Input */}
          {newTagInput?.catId === catId && newTagInput?.subId === sub.id && (
            <div className="flex gap-2 px-8 py-1">
              <input
                autoFocus
                value={newTagInput.value}
                onChange={(e) => setNewTagInput({ ...newTagInput, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTagInput.value.trim()) {
                    addTag(catId, sub.id, newTagInput.value.trim());
                    setNewTagInput({ ...newTagInput, value: '' });
                  } else if (e.key === 'Escape') setNewTagInput(null);
                }}
                placeholder={t('tagManager.newTag')}
                className="flex-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs text-slate-900 dark:text-white border border-cyan-500/20 shadow-inner"
              />
            </div>
          )}

          {/* Tags Droppable (Horizontal) */}
          <Droppable droppableId={`tags-${catId}:${sub.id}`} type="TAG" direction="horizontal">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="flex flex-wrap gap-1 px-8 min-h-[24px]"
              >
                {sub.tags.map((tag, tagIndex) => (
                  <Draggable key={`${sub.id}-${tag}`} draggableId={`${sub.id}-${tag}`} index={tagIndex}>
                    {(provided, snapshot) => (
                      <span
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-slate-700 dark:text-slate-200 group transition-all ${snapshot.isDragging ? 'scale-110 shadow-lg ring-1 ring-cyan-400' : ''}`}
                        style={{
                          ...provided.draggableProps.style,
                          background: snapshot.isDragging
                            ? (theme === 'dark' ? 'rgba(6, 182, 212, 0.4)' : 'rgba(8, 145, 178, 0.4)')
                            : (theme === 'dark'
                              ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(6, 182, 212, 0.05) 100%)'
                              : 'linear-gradient(135deg, rgba(8, 145, 178, 0.1) 0%, rgba(8, 145, 178, 0.05) 100%)'
                            ),
                          border: theme === 'dark'
                            ? '1px solid rgba(6, 182, 212, 0.25)'
                            : '1px solid rgba(8, 145, 178, 0.25)',
                        }}
                      >
                        {tag}
                        <button
                          onClick={() => removeTag(catId, sub.id, tag)}
                          className="opacity-40 group-hover:opacity-100 text-red-600 dark:text-red-400 transition-opacity hover:text-red-500"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      )}
    </Draggable>
  );
}


