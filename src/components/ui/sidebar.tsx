"use client";

import { cn } from "@/lib/utils";
import Link, { LinkProps } from "next/link";
import React, { useState, createContext, useContext } from "react";
import { Menu, X } from "lucide-react";

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
  indent?: number;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props: React.ComponentProps<"div">) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...props} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <div
      className={cn(
        "h-full py-4 hidden md:flex md:flex-col bg-white flex-shrink-0 border-r border-gray-200 transition-all duration-300 ease-in-out",
        open ? "w-[300px] px-4" : "w-[60px] px-2",
        !animate && "w-[300px]",
        className
      )}
      onMouseEnter={() => animate && setOpen(true)}
      onMouseLeave={() => animate && setOpen(false)}
      {...props}
    >
      {children}
    </div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();
  return (
    <>
      <div
        className={cn(
          "h-10 px-4 py-4 flex flex-row md:hidden items-center justify-between bg-white w-full border-b border-gray-200"
        )}
        {...props}
      >
        <div className="flex justify-end z-20 w-full">
          <Menu
            className="text-gray-700 cursor-pointer"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          />
        </div>
        {open && (
          <div
            className={cn(
              "fixed h-full w-full inset-0 bg-white p-10 z-[100] flex flex-col justify-between transition-all duration-300 ease-in-out",
              className
            )}
          >
            <div
              className="absolute right-10 top-10 z-50 text-gray-700 cursor-pointer"
              onClick={() => setOpen(!open)}
              aria-label="Close menu"
            >
              <X />
            </div>
            {children}
          </div>
        )}
      </div>
    </>
  );
};

export const SidebarLink = ({
  link,
  className,
  ...props
}: {
  link: Links;
  className?: string;
  props?: LinkProps;
}) => {
  const { open, animate } = useSidebar();
  const indentOffset = open ? (link.indent ?? 0) * 12 : 0;
  const isSubLink = (link.indent ?? 0) > 0;
  return (
    <Link
      href={link.href}
      className={cn(
        "flex items-center group/sidebar py-2.5 focus:outline-none rounded-lg transition-all duration-200",
        "border-0 outline-0 ring-0",
        open ? "justify-start gap-2 px-3" : "justify-center px-0",
        className
      )}
      aria-label={link.label}
      title={!open ? link.label : undefined}
      style={
        open && indentOffset > 0
          ? { paddingLeft: `${12 + indentOffset}px`, paddingRight: "12px" }
          : undefined
      }
      {...props}
    >
      {!isSubLink && (
        <div className={cn("flex-shrink-0", open ? "" : "w-full flex justify-center")}>
          <div className={cn("transition-all duration-200", open ? "" : "scale-125")}>
            {link.icon}
          </div>
        </div>
      )}
      <span
        className={cn(
          "text-gray-700 font-medium group-hover/sidebar:translate-x-1 transition-all duration-300 ease-in-out whitespace-pre inline-block overflow-hidden",
          isSubLink ? "text-sm text-gray-600" : "text-base",
          animate && !open ? "w-0 opacity-0 max-w-0" : "w-auto opacity-100 max-w-[200px]"
        )}
      >
        {link.label}
      </span>
    </Link>
  );
};

