"use client";
import { NoAccess } from "@/components/app/no-access";
import { PageHeader } from "@/components/app/page-header";
import { useCan } from "@/components/app/can";
import { AcademicLiveClasses } from "@/components/app/academic-live-classes";
import { AcademicLiveSubjects } from "@/components/app/academic-live-subjects";
import { AcademicLiveTeachers } from "@/components/app/academic-live-teachers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** The Academic page when connected to the API: years, classes, subjects and teachers. Calendar, notices, exams and grading have no API yet. */
export function AcademicLive() {
  const can = useCan();
  if (!can("academic.manage")) return <NoAccess need="the Academic permission" />;
  return (
    <>
      <PageHeader eyebrow="Academic" title="Academic." dim="Years, classes and teachers." />
      <Tabs defaultValue="years">
        <TabsList><TabsTrigger value="years">Years and classes</TabsTrigger><TabsTrigger value="subjects">Subjects</TabsTrigger><TabsTrigger value="teachers">Teachers</TabsTrigger></TabsList>
        <TabsContent value="years"><AcademicLiveClasses /></TabsContent>
        <TabsContent value="subjects"><AcademicLiveSubjects /></TabsContent>
        <TabsContent value="teachers"><AcademicLiveTeachers /></TabsContent>
      </Tabs>
      <p className="text-[13px] text-text-tertiary">The school calendar, notices, exams and grading are coming soon.</p>
    </>
  );
}
