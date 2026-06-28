import * as react from 'react';
import { ButtonHTMLAttributes, ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from 'react';

type ClassDict = Record<string, boolean | null | undefined>;
type ClassValue = string | number | null | undefined | false | ClassValue[] | ClassDict;
declare function cn(...inputs: ClassValue[]): string;

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Optional leading icon (e.g. a lucide-react icon element). */
    icon?: ReactNode;
}
declare function Button({ variant, size, icon, className, children, ...rest }: ButtonProps): react.JSX.Element;

type BadgeTone = 'brand' | 'slate' | 'green' | 'amber' | 'red' | 'indigo' | 'emerald';
interface BadgeProps {
    tone?: BadgeTone;
    children: ReactNode;
    className?: string;
}
/** Small status / source pill (e.g. lead status, listing source, private/agency). */
declare function Badge({ tone, children, className }: BadgeProps): react.JSX.Element;

interface CardProps {
    children: ReactNode;
    className?: string;
    onClick?: () => void;
}
/** Neutral content card (the app's ".data-card"). Clickable when onClick is set. */
declare function Card({ children, className, onClick }: CardProps): react.JSX.Element;
interface KpiCardProps {
    label: string;
    value: ReactNode;
    hint?: ReactNode;
    icon?: ReactNode;
    className?: string;
}
/** Dashboard KPI card (the app's ".kpi-card") — label, big value, optional hint/icon. */
declare function KpiCard({ label, value, hint, icon, className }: KpiCardProps): react.JSX.Element;

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    /** Optional leading (right, in RTL) icon. */
    icon?: ReactNode;
}
declare function Input({ label, icon, className, ...rest }: InputProps): react.JSX.Element;

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    children: ReactNode;
}
declare function Select({ label, className, children, ...rest }: SelectProps): react.JSX.Element;

type AvatarTone = 'brand' | 'amber' | 'slate';
interface AvatarProps {
    name?: string;
    tone?: AvatarTone;
    /** Diameter in px. */
    size?: number;
    className?: string;
}
/** Initial-circle avatar. */
declare function Avatar({ name, tone, size, className }: AvatarProps): react.JSX.Element;

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    /** Max width in px. */
    width?: number;
    children: ReactNode;
}
/** Centered dialog with a dimmed backdrop. Closes on backdrop click. */
declare function Modal({ open, onClose, title, subtitle, width, children }: ModalProps): react.JSX.Element | null;

interface SidebarItem {
    key: string;
    label: string;
    /** Optional icon element (e.g. a lucide-react icon). */
    icon?: ReactNode;
}
interface SidebarProps {
    brandLabel?: string;
    brandSubLabel?: string;
    logoText?: string;
    user?: {
        name?: string;
        role?: string;
    };
    /** Highlight the user block in amber (e.g. for a super-admin). */
    highlightUser?: boolean;
    items: SidebarItem[];
    activeKey: string;
    onSelect: (key: string) => void;
    /** Footer action buttons (settings / logout / etc.). */
    footer?: ReactNode;
    className?: string;
}
/** The navy navigation rail (generalized from the app's AppSidebar). */
declare function Sidebar({ brandLabel, brandSubLabel, logoText, user, highlightUser, items, activeKey, onSelect, footer, className, }: SidebarProps): react.JSX.Element;

interface SpinnerProps {
    /** Diameter in px. */
    size?: number;
    className?: string;
}
declare function Spinner({ size, className }: SpinnerProps): react.JSX.Element;

type IconButtonTone = 'default' | 'brand' | 'danger';
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    icon: ReactNode;
    /** Required for a11y on an icon-only control. */
    'aria-label': string;
    tone?: IconButtonTone;
}
declare function IconButton({ icon, tone, className, ...rest }: IconButtonProps): react.JSX.Element;

interface EmptyStateProps {
    icon?: ReactNode;
    title: string;
    description?: string;
    /** Optional call-to-action (e.g. a Button). */
    action?: ReactNode;
}
declare function EmptyState({ icon, title, description, action }: EmptyStateProps): react.JSX.Element;

type ToastTone = 'default' | 'success' | 'error';
interface ToastProps {
    children: ReactNode;
    tone?: ToastTone;
    className?: string;
}
/** Bottom-centered transient notification. Render conditionally; the app owns the timer. */
declare function Toast({ children, tone, className }: ToastProps): react.JSX.Element;

interface StatProps {
    label: string;
    value: ReactNode;
    className?: string;
}
/** Compact stat tile (rooms / floor / sqm cells inside a listing or property card). */
declare function Stat({ label, value, className }: StatProps): react.JSX.Element;

interface SectionHeaderProps {
    title: string;
    subtitle?: string;
    /** Right-aligned actions (buttons, filters). */
    actions?: ReactNode;
}
/** Page / section title row with optional subtitle and actions. */
declare function SectionHeader({ title, subtitle, actions }: SectionHeaderProps): react.JSX.Element;

interface ListingCardProps {
    title: string;
    subtitle?: string;
    address?: string;
    price: number;
    rooms: number;
    floor?: number;
    totalFloors?: number;
    sizeSqm: number;
    /** Source label, e.g. "Yad2" / "Madlan". */
    source?: string;
    /** "פרטי" | "בתיווך" — coloured emerald / indigo. */
    listedBy?: string;
    /** Direct link to the original ad; opens in a new tab. */
    sourceUrl?: string;
    /** Optional external-link icon (decorative). */
    linkIcon?: ReactNode;
    onClick?: () => void;
    className?: string;
}
/** Resale listing card — the flagship real-estate component (composes Card + Badge + Stat). */
declare function ListingCard({ title, subtitle, address, price, rooms, floor, totalFloors, sizeSqm, source, listedBy, sourceUrl, linkIcon, onClick, className, }: ListingCardProps): react.JSX.Element;

export { Avatar, type AvatarProps, type AvatarTone, Badge, type BadgeProps, type BadgeTone, Button, type ButtonProps, type ButtonSize, type ButtonVariant, Card, type CardProps, EmptyState, type EmptyStateProps, IconButton, type IconButtonProps, type IconButtonTone, Input, type InputProps, KpiCard, type KpiCardProps, ListingCard, type ListingCardProps, Modal, type ModalProps, SectionHeader, type SectionHeaderProps, Select, type SelectProps, Sidebar, type SidebarItem, type SidebarProps, Spinner, type SpinnerProps, Stat, type StatProps, Toast, type ToastProps, type ToastTone, cn };
