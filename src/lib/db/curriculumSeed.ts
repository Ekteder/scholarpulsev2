import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from './index';
import {
  curriculumSubjects,
  curriculumPapers,
  curriculumTopics,
} from './schema';

export interface SeedTopic {
  title: string;
  chapterNumber?: number;
}

export interface SeedPaper {
  title: string;
  paperCode: string;
  topics: SeedTopic[];
}

export interface SeedSubject {
  name: string;
  code: string;
  color: string;
  icon: string;
  papers: SeedPaper[];
}

export const HSC_SYLLABUS_SEED: SeedSubject[] = [
  // 1. বাংলা (Bangla)
  {
    name: 'বাংলা (Bangla)',
    code: 'bangla',
    color: '#E11D48',
    icon: 'BookOpen',
    papers: [
      {
        title: '১ম পত্র - গদ্য',
        paperCode: 'bangla_1st_prose',
        topics: [
          { title: '১. বাঙ্গালার নব্য লেখকদিগের প্রতি নিবেদন (বঙ্কিমচন্দ্র চট্টোপাধ্যায়)', chapterNumber: 1 },
          { title: '২. অপরিচিতা (রবীন্দ্রনাথ ঠাকুর)', chapterNumber: 2 },
          { title: '৩. সাহিত্যে খেলা (প্রমথ চৌধুরী)', chapterNumber: 3 },
          { title: '৪. বিলাসী (শরৎচন্দ্র চট্টোপাধ্যায়)', chapterNumber: 4 },
          { title: '৫. অর্ধাঙ্গী (রোকেয়া সাখাওয়াত হোসেন)', chapterNumber: 5 },
          { title: '৬. যৌবনের গান (কাজী নজরুল ইসলাম)', chapterNumber: 6 },
          { title: '৭. জীবন ও বৃক্ষ (মোতাহের হোসেন চৌধুরী)', chapterNumber: 7 },
          { title: '৮. গন্তব্য কাবুল (সৈয়দ মুজতবা আলী)', chapterNumber: 8 },
          { title: '৯. মাসি-পিসি (মানিক বন্দ্যোপাধ্যায়)', chapterNumber: 9 },
          { title: '১০. কপিলদাস মুর্মুর শেষ কাজ (শওকত আলী)', chapterNumber: 10 },
          { title: '১১. রেইনকোট (আখতারুজ্জামান ইলিয়াস)', chapterNumber: 11 },
          { title: '১২. নেকলেস (গী দ্য মোপাসাঁ)', chapterNumber: 12 },
        ],
      },
      {
        title: '১ম পত্র - কবিতা',
        paperCode: 'bangla_1st_poetry',
        topics: [
          { title: '১৩. ঋতু-বর্ণন (আলাওল)', chapterNumber: 13 },
          { title: '১৪. বিভীষণের প্রতি মেঘনাদ (মাইকেল মধুসূদন দত্ত)', chapterNumber: 14 },
          { title: '১৫. সোনার তরী (রবীন্দ্রনাথ ঠাকুর)', chapterNumber: 15 },
          { title: '১৬. বিদ্রোহী (কাজী নজরুল ইসলাম)', chapterNumber: 16 },
          { title: '১৭. সুচেতনা (জীবনানন্দ দাশ)', chapterNumber: 17 },
          { title: '১৮. প্রতিদান (জসীমউদ্দীন)', chapterNumber: 18 },
          { title: '১৯. তাহারেই পড়ে মনে (সুফিয়া কামাল)', chapterNumber: 19 },
          { title: '২০. পদ্মা (ফররুখ আহমদ)', chapterNumber: 20 },
          { title: '২১. ফেব্রুয়ারি ১৯৬৯ (শামসুর রাহমান)', chapterNumber: 21 },
          { title: '২২. আঠারো বছর বয়স (সুকান্ত ভট্টাচার্য)', chapterNumber: 22 },
          { title: '২৩. আমি কিংবদন্তির কথা বলছি (আবু জাফর ওবায়দুল্লাহ)', chapterNumber: 23 },
          { title: '২৪. প্রত্যাবর্তনের লজ্জা (আল মাহমুদ)', chapterNumber: 24 },
        ],
      },
      {
        title: '১ম পত্র - সহপাঠ',
        paperCode: 'bangla_1st_supplementary',
        topics: [
          { title: '২৫. লালসালু - উপন্যাস (সৈয়দ ওয়ালীউল্লাহ)', chapterNumber: 25 },
          { title: '২৬. সিরাজউদ্দৌলা - নাটক (সিকান্দার আবু জাফর)', chapterNumber: 26 },
        ],
      },
      {
        title: '২য় পত্র - মানবণ্টন',
        paperCode: 'bangla_2nd',
        topics: [
          { title: '২৭. উচ্চারণের নিয়ম', chapterNumber: 27 },
          { title: '২৮. বাংলা বানানের নিয়ম', chapterNumber: 28 },
          { title: '২৯. বাক্য শুদ্ধিকরণ', chapterNumber: 29 },
          { title: '৩০. এক কথায় প্রকাশ', chapterNumber: 30 },
          { title: '৩১. বাগধারা ও প্রবাদ-প্রবচন', chapterNumber: 31 },
          { title: '৩২. পারিভাষিক শব্দ', chapterNumber: 32 },
          { title: '৩৩. সমার্থক শব্দ', chapterNumber: 33 },
          { title: '৩৪. বিপরীতার্থক শব্দ', chapterNumber: 34 },
          { title: '৩৫. অনুবাদ', chapterNumber: 35 },
          { title: '৩৬. সারাংশ ও সারমর্ম', chapterNumber: 36 },
          { title: '৩৭. ভাব-সম্প্রসারণ', chapterNumber: 37 },
          { title: '৩৮. প্রতিবেদন রচনা', chapterNumber: 38 },
          { title: '৩৯. অনুচ্ছেদ রচনা', chapterNumber: 39 },
          { title: '৪০. পত্র লিখন (আবেদনপত্র/ব্যক্তিগত পত্র)', chapterNumber: 40 },
          { title: '৪১. প্রবন্ধ রচনা', chapterNumber: 41 },
        ],
      },
    ],
  },

  // 2. English
  {
    name: 'English',
    code: 'english',
    color: '#2563EB',
    icon: 'Languages',
    papers: [
      {
        title: '1st Paper',
        paperCode: 'english_1st',
        topics: [
          { title: '1. Unit 1: Education and Life', chapterNumber: 1 },
          { title: '2. Unit 2: Art and Craft', chapterNumber: 2 },
          { title: '3. Unit 3: Myths and Literature', chapterNumber: 3 },
          { title: '4. Unit 4: History', chapterNumber: 4 },
          { title: '5. Unit 5: Human Rights', chapterNumber: 5 },
          { title: '6. Unit 6: Dreams', chapterNumber: 6 },
          { title: '7. Unit 7: Youthful Achievers', chapterNumber: 7 },
          { title: '8. Unit 8: Relationships', chapterNumber: 8 },
          { title: '9. Unit 9: Adolescence', chapterNumber: 9 },
          { title: '10. Unit 10: Lifestyle', chapterNumber: 10 },
          { title: '11. Unit 11: Peace and Conflict', chapterNumber: 11 },
          { title: '12. Unit 12: Environment and Nature', chapterNumber: 12 },
        ],
      },
      {
        title: '2nd Paper',
        paperCode: 'english_2nd',
        topics: [
          { title: '13. Gap Filling without Clues', chapterNumber: 13 },
          { title: '14. Cloze Test with Clues', chapterNumber: 14 },
          { title: '15. Cloze Test without Clues', chapterNumber: 15 },
          { title: '16. Rearranging', chapterNumber: 16 },
          { title: '17. Completing Sentences', chapterNumber: 17 },
          { title: '18. Right Form of Verbs', chapterNumber: 18 },
          { title: '19. Preposition', chapterNumber: 19 },
          { title: '20. Use of Articles', chapterNumber: 20 },
          { title: '21. Transformation of Sentences', chapterNumber: 21 },
          { title: '22. Narration (Direct-Indirect Speech)', chapterNumber: 22 },
          { title: '23. Paragraph Writing', chapterNumber: 23 },
          { title: '24. Formal Letter / Email Writing', chapterNumber: 24 },
          { title: '25. Report Writing', chapterNumber: 25 },
          { title: '26. Graph/Chart Description', chapterNumber: 26 },
          { title: '27. CV Writing with Cover Letter', chapterNumber: 27 },
          { title: '28. Summary Writing', chapterNumber: 28 },
          { title: '29. Composition / Essay Writing', chapterNumber: 29 },
        ],
      },
    ],
  },

  // 3. তথ্য ও যোগাযোগ প্রযুক্তি (ICT)
  {
    name: 'তথ্য ও যোগাযোগ প্রযুক্তি (ICT)',
    code: 'ict',
    color: '#0D9488',
    icon: 'Binary',
    papers: [
      {
        title: 'তথ্য ও যোগাযোগ প্রযুক্তি',
        paperCode: 'ict_main',
        topics: [
          { title: '১. বিশ্ব ও বাংলাদেশ প্রেক্ষিত', chapterNumber: 1 },
          { title: '২. কমিউনিকেশন সিস্টেমস ও নেটওয়ার্কিং', chapterNumber: 2 },
          { title: '৩. সংখ্যা পদ্ধতি ও ডিজিটাল ডিভাইস', chapterNumber: 3 },
          { title: '৪. ওয়েব ডিজাইন পরিচিতি এবং এইচটিএমএল', chapterNumber: 4 },
          { title: '৫. প্রোগ্রামিং ভাষা', chapterNumber: 5 },
          { title: '৬. ডেটাবেজ ম্যানেজমেন্ট সিস্টেম', chapterNumber: 6 },
        ],
      },
    ],
  },

  // 4. পদার্থবিজ্ঞান (Physics)
  {
    name: 'পদার্থবিজ্ঞান (Physics)',
    code: 'physics',
    color: '#3B82F6',
    icon: 'Atom',
    papers: [
      {
        title: '১ম পত্র',
        paperCode: 'physics_1st',
        topics: [
          { title: '১. ভৌত জগৎ ও পরিমাপ', chapterNumber: 1 },
          { title: '২. ভেক্টর', chapterNumber: 2 },
          { title: '৩. গতিবিদ্যা', chapterNumber: 3 },
          { title: '৪. নিউটনিয়ান বলবিদ্যা', chapterNumber: 4 },
          { title: '৫. কাজ, শক্তি ও ক্ষমতা', chapterNumber: 5 },
          { title: '৬. মহাকর্ষ ও অভিকর্ষ', chapterNumber: 6 },
          { title: '৭. পদার্থের গাঠনিক ধর্ম', chapterNumber: 7 },
          { title: '৮. পর্যাবৃত্ত গতি', chapterNumber: 8 },
          { title: '৯. তরঙ্গ', chapterNumber: 9 },
          { title: '১০. আদর্শ গ্যাস ও গ্যাসের গতিতত্ত্ব', chapterNumber: 10 },
        ],
      },
      {
        title: '২য় পত্র',
        paperCode: 'physics_2nd',
        topics: [
          { title: '১১. তাপগতিবিদ্যা', chapterNumber: 11 },
          { title: '১২. স্থির তড়িৎ', chapterNumber: 12 },
          { title: '১৩. চল তড়িৎ', chapterNumber: 13 },
          { title: '১৪. তড়িৎ প্রবাহের চৌম্বক ক্রিয়া ও চুম্বকত্ব', chapterNumber: 14 },
          { title: '১৫. তড়িৎচৌম্বকীয় আবেশ ও দিক পরিবর্তী প্রবাহ', chapterNumber: 15 },
          { title: '১৬. জ্যামিতিক আলোকবিজ্ঞান', chapterNumber: 16 },
          { title: '১৭. ভৌত আলোকবিজ্ঞান', chapterNumber: 17 },
          { title: '১৮. আধুনিক পদার্থবিজ্ঞানের সূচনা', chapterNumber: 18 },
          { title: '১৯. পরমাণুর মডেল ও নিউক্লিয়ার পদার্থবিজ্ঞান', chapterNumber: 19 },
          { title: '২০. সেমিকন্ডাক্টর ও ইলেকট্রনিক্স', chapterNumber: 20 },
          { title: '২১. জ্যোতির্বিজ্ঞান', chapterNumber: 21 },
        ],
      },
    ],
  },

  // 5. রসায়ন (Chemistry)
  {
    name: 'রসায়ন (Chemistry)',
    code: 'chemistry',
    color: '#D97706',
    icon: 'FlaskConical',
    papers: [
      {
        title: '১ম পত্র',
        paperCode: 'chemistry_1st',
        topics: [
          { title: '১. ল্যাবরেটরির নিরাপদ ব্যবহার', chapterNumber: 1 },
          { title: '২. গুণগত রসায়ন', chapterNumber: 2 },
          { title: '৩. মৌলের পর্যায়বৃত্ত ধর্ম ও রাসায়নিক বন্ধন', chapterNumber: 3 },
          { title: '৪. রাসায়নিক পরিবর্তন', chapterNumber: 4 },
          { title: '৫. কর্মমুখী রসায়ন', chapterNumber: 5 },
        ],
      },
      {
        title: '২য় পত্র',
        paperCode: 'chemistry_2nd',
        topics: [
          { title: '৬. পরিবেশ রসায়ন', chapterNumber: 6 },
          { title: '৭. জৈব রসায়ন', chapterNumber: 7 },
          { title: '৮. পরিমাণগত রসায়ন', chapterNumber: 8 },
          { title: '৯. তড়িৎ রসায়ন', chapterNumber: 9 },
          { title: '১০. অর্থনৈতিক রসায়ন', chapterNumber: 10 },
        ],
      },
    ],
  },

  // 6. উচ্চতর গণিত (Higher Mathematics)
  {
    name: 'উচ্চতর গণিত (Higher Mathematics)',
    code: 'higher_math',
    color: '#7C3AED',
    icon: 'Calculator',
    papers: [
      {
        title: '১ম পত্র',
        paperCode: 'higher_math_1st',
        topics: [
          { title: '১. ম্যাট্রিক্স ও নির্ণায়ক', chapterNumber: 1 },
          { title: '২. ভেক্টর', chapterNumber: 2 },
          { title: '৩. সরলরেখা', chapterNumber: 3 },
          { title: '৪. বৃত্ত', chapterNumber: 4 },
          { title: '৫. বিন্যাস ও সমাবেশ', chapterNumber: 5 },
          { title: '৬. ত্রিকোণমিতিক অনুপাত', chapterNumber: 6 },
          { title: '৭. সংযুক্ত কোণের ত্রিকোণমিতিক অনুপাত', chapterNumber: 7 },
          { title: '৮. ফাংশন ও ফাংশনের লেখচিত্র', chapterNumber: 8 },
          { title: '৯. অন্তরীকরণ (ক্যালকুলাস)', chapterNumber: 9 },
          { title: '১০. যোগজীকরণ (ক্যালকুলাস)', chapterNumber: 10 },
        ],
      },
      {
        title: '২য় পত্র',
        paperCode: 'higher_math_2nd',
        topics: [
          { title: '১১. বাস্তব সংখ্যা ও অসমতা', chapterNumber: 11 },
          { title: '১২. যোগাশ্রয়ী প্রোগ্রাম', chapterNumber: 12 },
          { title: '১৩. জটিল সংখ্যা', chapterNumber: 13 },
          { title: '১৪. বহুপদী ও বহুপদী সমীকরণ', chapterNumber: 14 },
          { title: '১৫. দ্বিপদী বিস্তৃতি', chapterNumber: 15 },
          { title: '১৬. কণিক', chapterNumber: 16 },
          { title: '১৭. বিপরীত ত্রিকোণমিতিক ফাংশন ও ত্রিকোণমিতিক সমীকরণ', chapterNumber: 17 },
          { title: '১৮. স্থিতিবিদ্যা', chapterNumber: 18 },
          { title: '১৯. সমতলে বস্তুকণার গতি', chapterNumber: 19 },
          { title: '২০. বিস্তার পরিমাপ ও সম্ভাবনা', chapterNumber: 20 },
        ],
      },
    ],
  },

  // 7. জীববিজ্ঞান (Biology)
  {
    name: 'জীববিজ্ঞান (Biology)',
    code: 'biology',
    color: '#059669',
    icon: 'Dna',
    papers: [
      {
        title: '১ম পত্র - উদ্ভিদবিজ্ঞান',
        paperCode: 'biology_1st_botany',
        topics: [
          { title: '১. কোষ ও এর গঠন', chapterNumber: 1 },
          { title: '২. কোষ বিভাজন', chapterNumber: 2 },
          { title: '৩. কোষ রসায়ন', chapterNumber: 3 },
          { title: '৪. অণুজীব', chapterNumber: 4 },
          { title: '৫. শৈবাল ও ছত্রাক', chapterNumber: 5 },
          { title: '৬. ব্রায়োফাইটা ও টেরিডোফাইটা', chapterNumber: 6 },
          { title: '৭. নগ্নবীজী ও আবৃতবীজী উদ্ভিদ', chapterNumber: 7 },
          { title: '৮. টিস্যু ও টিস্যুতন্ত্র', chapterNumber: 8 },
          { title: '৯. উদ্ভিদ শরীরতত্ত্ব', chapterNumber: 9 },
          { title: '১০. উদ্ভিদ প্রজনন', chapterNumber: 10 },
          { title: '১১. জীবপ্রযুক্তি', chapterNumber: 11 },
          { title: '১২. জীবের পরিবেশ, বিস্তার ও সংরক্ষণ', chapterNumber: 12 },
        ],
      },
      {
        title: '২য় পত্র - প্রাণিবিজ্ঞান',
        paperCode: 'biology_2nd_zoology',
        topics: [
          { title: '১৩. প্রাণীর বিভিন্নতা ও শ্রেণিবিন্যাস', chapterNumber: 13 },
          { title: '১৪. প্রাণীর পরিচিতি', chapterNumber: 14 },
          { title: '১৫. মানব শরীরতত্ত্ব: পরিপাক ও শোষণ', chapterNumber: 15 },
          { title: '১৬. মানব শরীরতত্ত্ব: রক্ত ও সংবহন', chapterNumber: 16 },
          { title: '১৭. মানব শরীরতত্ত্ব: শ্বসন ও শ্বাসক্রিয়া', chapterNumber: 17 },
          { title: '১৮. মানব শরীরতত্ত্ব: বর্জ্য ও নিষ্কাশন', chapterNumber: 18 },
          { title: '১৯. মানব শরীরতত্ত্ব: চলন ও অঙ্গচালনা', chapterNumber: 19 },
          { title: '২০. মানব শরীরতত্ত্ব: সমন্বয় ও নিয়ন্ত্রণ', chapterNumber: 20 },
          { title: '২১. মানব জীবনের ধারাবাহিকতা', chapterNumber: 21 },
          { title: '২২. মানবদেহের প্রতিরক্ষা', chapterNumber: 22 },
          { title: '২৩. জিনতত্ত্ব ও বিবর্তন', chapterNumber: 23 },
          { title: '২৪. প্রাণীর আচরণ', chapterNumber: 24 },
        ],
      },
    ],
  },
];

import {
  DEFAULT_SUBJECTS,
  DEFAULT_PAPERS,
  DEFAULT_TOPICS,
  DEFAULT_SUBJECT_BY_ID,
  DEFAULT_PAPER_BY_ID,
  DEFAULT_TOPIC_BY_ID,
  STATIC_TOPIC_IDS,
  STATIC_SUBJECT_IDS,
  STATIC_PAPER_IDS,
  isStaticTopicId,
  isStaticSubjectId,
  isStaticPaperId,
} from '../syllabusData';

export {
  DEFAULT_SUBJECTS,
  DEFAULT_PAPERS,
  DEFAULT_TOPICS,
  DEFAULT_SUBJECT_BY_ID,
  DEFAULT_PAPER_BY_ID,
  DEFAULT_TOPIC_BY_ID,
  STATIC_TOPIC_IDS,
  STATIC_SUBJECT_IDS,
  STATIC_PAPER_IDS,
  isStaticTopicId,
  isStaticSubjectId,
  isStaticPaperId,
};

let isSeedEnsured = false;
let seedPromise: Promise<void> | null = null;

export async function ensureCurriculumSeedData(force: boolean = false): Promise<void> {
  if (isSeedEnsured && !force) return;
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    try {
      if (!force) {
        // Check if default seeded topics already exist in DB
        const existing = await db
          .select({ id: curriculumTopics.id })
          .from(curriculumTopics)
          .where(isNull(curriculumTopics.userId))
          .limit(1);

        if (existing.length >= 1) {
          isSeedEnsured = true;
          return;
        }
      }

      // Batch insert deterministic default subjects
      await db
        .insert(curriculumSubjects)
        .values(
          DEFAULT_SUBJECTS.map((subj) => ({
            id: subj.id,
            name: subj.name,
            code: subj.code,
            color: subj.color,
            icon: subj.icon,
            displayOrder: subj.displayOrder,
            userId: null,
          }))
        )
        .onConflictDoNothing();

      // Batch insert deterministic default papers
      await db
        .insert(curriculumPapers)
        .values(
          DEFAULT_PAPERS.map((paper) => ({
            id: paper.id,
            subjectId: paper.subjectId,
            title: paper.title,
            paperCode: paper.paperCode,
            displayOrder: paper.displayOrder,
            userId: null,
          }))
        )
        .onConflictDoNothing();

      // Batch insert deterministic default topics in chunks of 50
      for (let i = 0; i < DEFAULT_TOPICS.length; i += 50) {
        const chunk = DEFAULT_TOPICS.slice(i, i + 50);
        await db
          .insert(curriculumTopics)
          .values(
            chunk.map((t) => ({
              id: t.id,
              paperId: t.paperId,
              subjectId: t.subjectId,
              title: t.title,
              chapterNumber: t.chapterNumber,
              displayOrder: t.displayOrder,
              userId: null,
            }))
          )
          .onConflictDoNothing();
      }

      isSeedEnsured = true;
      console.log('✓ HSC Curriculum Syllabus Seed checked and ready (Code-First Deterministic IDs).');
    } catch (error) {
      console.error('Failed to ensure curriculum seed data:', error);
      throw error;
    } finally {
      seedPromise = null;
    }
  })();

  return seedPromise;
}

