import { create } from 'zustand'
import { api } from '../api'
import { setLang as setI18nLang } from '../i18n'

// --------- helpers ---------
const uid = () => Math.random().toString(36).slice(2, 14)

const DEFAULT_CUSTOMIZE = {
  template: 'flowcv-style',
  columns: 'single',
  page_breaks: [],
  spacing_preset: 'normal',
  font_family: 'Inter',
  font_size: 10.5,
  line_height: 1.4,
  section_margin: 14,
  entry_spacing: 8,
  page_margin: 40,
  paper: 'A4',
  subtitle_font: 'Inter',
  subtitle_size: 11,
  subtitle_case: 'upper',
  subtitle_weight: '700',
  subtitle_color: '#111827',
  subtitle_style: 'underline',
  date_format: 'slash',
  entry_layouts: {
    experience: 'dates-left',
    education:  'dates-left',
    projects:   'dates-left',
  },
  personal_alignment: 'left',
  personal_arrangement: 'name-contact',
  show_photo: true,
  photo_shape: 'circle',
  photo_position: 'right',
  photo_size: 90,
  accent_color: '#2563eb',
  text_color: '#111827',
  contacts_columns: 'single',
}

const DEFAULT_PERSONAL = {
  full_name: '',
  job_title: '',
  email: '',
  phone: '',
  location: '',
  website: '',
  linkedin: '',
  github: '',
  wechat: '',
  qq: '',
  date_of_birth: '',
  summary_line: '',
  photo_url: '',
  visible_fields: [],
}

export const MODULE_BLUEPRINTS = {
  summary:       { icon: 'file-text',      name: 'Summary' },
  education:     { icon: 'graduation-cap', name: 'Education' },
  experience:    { icon: 'briefcase',      name: 'Experience' },
  projects:      { icon: 'folder-git-2',   name: 'Projects' },
  skills:        { icon: 'wrench',         name: 'Skills' },
  awards:        { icon: 'award',          name: 'Awards & Certificates' },
  custom:        { icon: 'circle',         name: 'Custom' },
  page_break:    { icon: 'scissors',       name: 'Page Break' },
}

export const EMPTY_ENTRY = {
  summary:    () => ({ id: uid(), content: '',  hidden: false }),
  education:  () => ({ id: uid(), school: '', degree: '', field_of_study: '',
                       start_date: '', end_date: '', is_full_time: true,
                       gpa: '', location: '', description: '', hidden: false }),
  experience: () => ({ id: uid(), company: '', position: '', start_date: '',
                       end_date: '', currently_working: false, location: '',
                       description: '', hidden: false }),
  projects:   () => ({ id: uid(), name: '', role: '', start_date: '',
                       end_date: '', link: '', description: '', hidden: false }),
  skills:     () => ({ id: uid(), category: '', items: [], level: '', hidden: false }),
  awards:     () => ({ id: uid(), title: '', issuer: '', date: '',
                       description: '', hidden: false }),
  custom:     () => ({ id: uid(), title: '', subtitle: '', date: '',
                       description: '', hidden: false }),
  page_break: () => ({ id: uid(), hidden: false }),
}

function newResume() {
  return {
    id: uid(),
    title: 'Untitled Resume',
    language: 'en',
    personal: { ...DEFAULT_PERSONAL },
    customize: { ...DEFAULT_CUSTOMIZE },
    modules: Object.keys(MODULE_BLUEPRINTS)
      .filter((t) => t !== 'custom')
      .map((type) => ({
        id: uid(),
        type,
        name: MODULE_BLUEPRINTS[type].name,
        icon: MODULE_BLUEPRINTS[type].icon,
        hidden: false,
        entries: [],
      })),
    created_at: '',
    updated_at: '',
  }
}

// --------- store ---------
export const useResumeStore = create((set, get) => ({
  resume: newResume(),
  activeTab: 'content',            // profile | content | customize
  activeModuleId: null,
  activeEntryId: null,
  savedAt: null,
  saving: false,

  // --------- basic ---------
  setActiveTab: (activeTab) => set({ activeTab }),
  setActiveModule: (activeModuleId) =>
    set({ activeModuleId, activeEntryId: null }),
  setActiveEntry: (activeEntryId) => set({ activeEntryId }),

  replaceResume: (resume) => set({ resume }),
  resetResume: () => set({ resume: newResume(), activeModuleId: null, activeEntryId: null }),

  setTitle: (title) => set((s) => ({ resume: { ...s.resume, title } })),
  setLanguage: (language) => {
    setI18nLang(language)
    set((s) => ({ resume: { ...s.resume, language } }))
  },

  // --------- personal ---------
  updatePersonal: (patch) =>
    set((s) => ({ resume: { ...s.resume, personal: { ...s.resume.personal, ...patch } } })),

  // --------- customize ---------
  updateCustomize: (patch) =>
    set((s) => ({ resume: { ...s.resume, customize: { ...s.resume.customize, ...patch } } })),

  togglePageBreak: (moduleId) =>
    set((s) => {
      const pb = new Set(s.resume.customize.page_breaks)
      pb.has(moduleId) ? pb.delete(moduleId) : pb.add(moduleId)
      return {
        resume: { ...s.resume, customize: { ...s.resume.customize, page_breaks: [...pb] } },
      }
    }),

  // --------- modules ---------
  addModule: (type = 'custom') =>
    set((s) => {
      const bp = MODULE_BLUEPRINTS[type] || MODULE_BLUEPRINTS.custom
      const mod = { id: uid(), type, name: bp.name, icon: bp.icon, hidden: false, entries: [] }
      return { resume: { ...s.resume, modules: [...s.resume.modules, mod] }, activeModuleId: mod.id }
    }),

  updateModule: (moduleId, patch) =>
    set((s) => ({
      resume: {
        ...s.resume,
        modules: s.resume.modules.map((m) => (m.id === moduleId ? { ...m, ...patch } : m)),
      },
    })),

  removeModule: (moduleId) =>
    set((s) => ({
      resume: { ...s.resume, modules: s.resume.modules.filter((m) => m.id !== moduleId) },
      activeModuleId: s.activeModuleId === moduleId ? null : s.activeModuleId,
    })),

  reorderModules: (orderedIds) =>
    set((s) => {
      const byId = new Map(s.resume.modules.map((m) => [m.id, m]))
      return {
        resume: {
          ...s.resume,
          modules: orderedIds.map((id) => byId.get(id)).filter(Boolean),
        },
      }
    }),

  // --------- entries ---------
  addEntry: (moduleId) =>
    set((s) => {
      const mod = s.resume.modules.find((m) => m.id === moduleId)
      if (!mod) return s
      const factory = EMPTY_ENTRY[mod.type] || EMPTY_ENTRY.custom
      const entry = factory()
      return {
        resume: {
          ...s.resume,
          modules: s.resume.modules.map((m) =>
            m.id === moduleId ? { ...m, entries: [...m.entries, entry] } : m
          ),
        },
        activeEntryId: entry.id,
      }
    }),

  updateEntry: (moduleId, entryId, patch) =>
    set((s) => ({
      resume: {
        ...s.resume,
        modules: s.resume.modules.map((m) =>
          m.id === moduleId
            ? {
                ...m,
                entries: m.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
              }
            : m
        ),
      },
    })),

  removeEntry: (moduleId, entryId) =>
    set((s) => ({
      resume: {
        ...s.resume,
        modules: s.resume.modules.map((m) =>
          m.id === moduleId ? { ...m, entries: m.entries.filter((e) => e.id !== entryId) } : m
        ),
      },
      activeEntryId: s.activeEntryId === entryId ? null : s.activeEntryId,
    })),

  reorderEntries: (moduleId, orderedIds) =>
    set((s) => ({
      resume: {
        ...s.resume,
        modules: s.resume.modules.map((m) => {
          if (m.id !== moduleId) return m
          const byId = new Map(m.entries.map((e) => [e.id, e]))
          return { ...m, entries: orderedIds.map((id) => byId.get(id)).filter(Boolean) }
        }),
      },
    })),

  // --------- persistence ---------
  save: async () => {
    set({ saving: true })
    try {
      const saved = await api.saveResume(get().resume)
      set({ resume: saved, savedAt: new Date(), saving: false })
    } catch (e) {
      set({ saving: false })
      throw e
    }
  },

  load: async (id) => {
    const r = await api.getResume(id)
    setI18nLang(r.language || 'en')
    set({ resume: r, activeModuleId: null, activeEntryId: null })
  },

  // Copy the personal block from the profile library into the current resume.
  // Callers pass in the profile.personal record; we overlay any non-empty
  // values (so we don't wipe fields the user already filled in the resume).
  syncPersonalFromProfile: (profilePersonal) =>
    set((s) => {
      if (!profilePersonal) return s
      const next = { ...s.resume.personal }
      Object.entries(profilePersonal).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') next[k] = v
      })
      // visible_fields: copy if profile has any non-empty list
      if (Array.isArray(profilePersonal.visible_fields) && profilePersonal.visible_fields.length) {
        next.visible_fields = profilePersonal.visible_fields
      }
      return { resume: { ...s.resume, personal: next } }
    }),
}))
