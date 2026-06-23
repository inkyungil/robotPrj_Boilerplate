"""Create tables and seed 210 realistic books with 120+ unique titles.

Run from chatbot/backend:  python scripts/seed_books.py
"""

import os
import sys
import json
import random

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import Base, SessionLocal, engine
from app.models import Book

# 120 Unique Real-World Books
UNIQUE_REAL_BOOKS = [
    # === Fiction (소설) - 20 unique books ===
    {
        "title_kr": "불편한 편의점", "title_en": "The Uncanny Convenience Store", "title_zh": "不便的便利店", "title_vi": "Cửa hàng tiện lợi bất tiện",
        "author": "김호연", "category": "fiction", "cover": "🏪", "color": "from-amber-200 to-orange-300",
        "summary_kr": "서울역 노숙인 독고가 골목 편의점 야간 알바로 일하며 이웃들과 나누는 따뜻한 소통과 치유.",
        "tags_kr": ["#일상의위로", "#따뜻한소설", "#김호연"]
    },
    {
        "title_kr": "메리골드 마음 세탁소", "title_en": "Marigold Mind Laundry", "title_zh": "金盏花心灵洗衣店", "title_vi": "Tiệm giặt là tâm hồn Marigold",
        "author": "윤정은", "category": "fiction", "cover": "🧺", "color": "from-rose-200 to-rose-300",
        "summary_kr": "마음의 상처와 슬픈 기억을 깨끗하게 지워주는 신비로운 세탁소 이야기.",
        "tags_kr": ["#힐링소설", "#상처치유", "#베스트셀러"]
    },
    {
        "title_kr": "아몬드", "title_en": "Almond", "title_zh": "杏仁", "title_vi": "Hạnh nhân",
        "author": "손원평", "category": "fiction", "cover": "🥜", "color": "from-orange-200 to-amber-300",
        "summary_kr": "감정을 느끼지 못하는 소년 윤재의 특별한 성장과 타인과의 교감 이야기.",
        "tags_kr": ["#청소년문학", "#감동소설", "#손원평"]
    },
    {
        "title_kr": "구의 증명", "title_en": "Proof of Gu", "title_zh": "九의证明", "title_vi": "Chứng minh của Gu",
        "author": "최진영", "category": "fiction", "cover": "🕯️", "color": "from-red-200 to-rose-300",
        "summary_kr": "가장 비극적인 사랑 속에서 연인의 존재를 증명하려는 처절하고 아름다운 소설.",
        "tags_kr": ["#사랑소설", "#비극미", "#최진영"]
    },
    {
        "title_kr": "나미야 잡화점의 기적", "title_en": "The Miracle of the Namiya General Store", "title_zh": "解忧杂货店", "title_vi": "Tiệm tạp hóa Namiya",
        "author": "히가시노 게이고", "category": "fiction", "cover": "📮", "color": "from-yellow-200 to-amber-300",
        "summary_kr": "과거와 현재를 연결하는 기적의 편지함을 통해 사람들의 고민을 해결해주는 따뜻한 추리 소설.",
        "tags_kr": ["#추리소설", "#기적", "#감동"]
    },
    {
        "title_kr": "위대한 개츠비", "title_en": "The Great Gatsby", "title_zh": "伟大的盖茨比", "title_vi": "Gatsby vĩ đại",
        "author": "F. 스콧 피츠제럴드", "category": "fiction", "cover": "🥂", "color": "from-yellow-100 to-amber-200",
        "summary_kr": "1920년대 미국 재즈 시대를 배경으로 일그러진 아메리칸 드림과 집착에 가까운 사랑을 그린 고전.",
        "tags_kr": ["#세계문학", "#미국고전", "#피츠제럴드"]
    },
    {
        "title_kr": "데미안", "title_en": "Demian", "title_zh": "德米安", "title_vi": "Demian",
        "author": "헤르만 헤세", "category": "fiction", "cover": "🥚", "color": "from-teal-100 to-emerald-200",
        "summary_kr": "알을 깨고 나와 자신만의 진정한 자아를 발견해 나가는 싱클레어의 성장을 그린 성장 소설.",
        "tags_kr": ["#성장소설", "#헤르만헤세", "#자아발견"]
    },
    {
        "title_kr": "인간 실격", "title_en": "No Longer Human", "title_zh": "人间失格", "title_vi": "Thất lạc cõi người",
        "author": "다자이 오사무", "category": "fiction", "cover": "🎭", "color": "from-slate-200 to-zinc-300",
        "summary_kr": "세상과의 소통에 실패하고 순수한 영혼을 잃어버려 파멸해가는 한 인간의 처절한 고백.",
        "tags_kr": ["#일본문학", "#어두운소설", "#고백"]
    },
    {
        "title_kr": "소년이 온다", "title_en": "Human Acts", "title_zh": "少年来了", "title_vi": "Bản chất của con người",
        "author": "한강", "category": "fiction", "cover": "🕯️", "color": "from-stone-200 to-neutral-300",
        "summary_kr": "5·18 광주민주화운동을 배경으로 인간의 잔혹함과 존엄성에 질문을 던지는 노벨문학상 수상작.",
        "tags_kr": ["#노벨문학상", "#한강", "#역사소설"]
    },
    {
        "title_kr": "채식주의자", "title_en": "The Vegetarian", "title_zh": "素食主义者", "title_vi": "Người ăn chay",
        "author": "한강", "category": "fiction", "cover": "🌱", "color": "from-green-100 to-emerald-200",
        "summary_kr": "폭력을 거부하며 나무가 되고자 육식을 거부하는 여성 영혜를 둘러싼 세 가지 시선.",
        "tags_kr": ["#맨부커상", "#한강", "#현대문학"]
    },
    {
        "title_kr": "모순", "title_en": "Contradiction", "title_zh": "矛盾", "title_vi": "Mâu thuẫn",
        "author": "양귀자", "category": "fiction", "cover": "🔄", "color": "from-purple-100 to-indigo-200",
        "summary_kr": "인생의 모순과 선택을 마주한 안진진의 삶의 여정을 그린 한국 대표 소설.",
        "tags_kr": ["#양귀자", "#인생소설", "#관계"]
    },
    {
        "title_kr": "미드나잇 라이브러리", "title_en": "The Midnight Library", "title_zh": "午夜图书馆", "title_vi": "Thư viện nửa đêm",
        "author": "맷 헤이그", "category": "fiction", "cover": "🌙", "color": "from-indigo-300 to-purple-400",
        "summary_kr": "후회로 가득한 삶을 뒤로하고, 다른 삶을 살아볼 수 있는 기회를 주는 특별한 도서관 이야기.",
        "tags_kr": ["#판타지소설", "#후회없는삶", "#선택"]
    },
    {
        "title_kr": "파친코", "title_en": "Pachinko", "title_zh": "弹子机", "title_vi": "Pachinko",
        "author": "이민진", "category": "fiction", "cover": "🎰", "color": "from-amber-200 to-red-200",
        "summary_kr": "4대에 걸친 재일조선인 가족의 이민 역사와 극복의 대서사시.",
        "tags_kr": ["#이민사", "#대서사시", "#재일교포"]
    },
    {
        "title_kr": "가짜 팔로워", "title_en": "Fake Followers", "title_zh": "虚假粉丝", "title_vi": "Người theo dõi giả",
        "author": "김은우", "category": "fiction", "cover": "📱", "color": "from-rose-100 to-pink-200",
        "summary_kr": "SNS 시대의 가짜 삶과 소외감을 흥미진진한 스릴러 형식으로 풀어낸 현대 소설.",
        "tags_kr": ["#현대소설", "#SNS스릴러", "#소외감"]
    },
    {
        "title_kr": "밝은 밤", "title_en": "Bright Nights", "title_zh": "明亮的夜晚", "title_vi": "Đêm sáng",
        "author": "최은영", "category": "fiction", "cover": "💡", "color": "from-blue-100 to-sky-200",
        "summary_kr": "증조할머니부터 나에게로 이어지는 네 여성의 삶과 연대를 그린 따뜻한 소설.",
        "tags_kr": ["#여성연대", "#가족사", "#최은영"]
    },
    {
        "title_kr": "작별하지 않는다", "title_en": "I Do Not Bid Farewell", "title_zh": "永不 작별", "title_vi": "Không lời từ biệt",
        "author": "한강", "category": "fiction", "cover": "❄️", "color": "from-cyan-100 to-slate-200",
        "summary_kr": "제주 4·3 사건의 참상을 지극히 아름답고도 슬픈 심상으로 그려낸 한강의 장편 소설.",
        "tags_kr": ["#노벨문학상", "#제주43", "#한강"]
    },
    {
        "title_kr": "모래알만 한 진실이라도", "title_en": "Even a Grain of Truth", "title_zh": "哪怕只有沙粒般的真实", "title_vi": "Dù chỉ là hạt cát sự thật",
        "author": "박완서", "category": "fiction", "cover": "🌾", "color": "from-yellow-100 to-amber-200",
        "summary_kr": "박완서 작가가 평생 마주한 일상의 소소하고 깊이 있는 성찰이 가득한 소설 에세이.",
        "tags_kr": ["#박완서", "#한국문학", "#따뜻한시선"]
    },
    {
        "title_kr": "해리 포터와 마법사의 돌", "title_en": "Harry Potter and the Philosopher's Stone", "title_zh": "哈利波特与魔法石", "title_vi": "Harry Potter và hòn đá phù thủy",
        "author": "J.K. Rowling", "category": "fiction", "cover": "🪄", "color": "from-yellow-200 to-orange-300",
        "summary_kr": "고아 소년 해리 포터가 마법 학교 호그와트에 입학하며 겪는 환상적인 마법 판타지 입문서.",
        "tags_kr": ["#판타지", "#호그와트", "#전세계베스트셀러"]
    },
    {
        "title_kr": "참을 수 없는 존재의 가벼움", "title_en": "The Unbearable Lightness of Being", "title_zh": "不能承受的生命之轻", "title_vi": "Đời nhẹ khôn kham",
        "author": "밀란 쿤데라", "category": "fiction", "cover": "🎈", "color": "from-sky-100 to-indigo-200",
        "summary_kr": "역사와 개인의 삶 속에서 무거움과 가벼움의 철학적 물음을 던지는 밀란 쿤데라의 명작.",
        "tags_kr": ["#밀란쿤데라", "#철학소설", "#세계고전"]
    },
    {
        "title_kr": "셜록 홈즈: 주홍색 연구", "title_en": "A Study in Scarlet", "title_zh": "血字的研究", "title_vi": "Chiếc nhẫn tình cờ",
        "author": "아서 코난 도일", "category": "fiction", "cover": "🔍", "color": "from-zinc-200 to-stone-400",
        "summary_kr": "명탐정 셜록 홈즈와 왓슨 박사의 첫 만남과 전설적인 추리의 시작을 기록한 첫 소설.",
        "tags_kr": ["#추리고전", "#셜록홈즈", "#코난도일"]
    },

    # === Self-Improvement (자기계발) - 20 unique books ===
    {
        "title_kr": "아주 작은 습관의 힘", "title_en": "Atomic Habits", "title_zh": "原子习惯", "title_vi": "Thói quen nguyên tử",
        "author": "James Clear", "category": "self", "cover": "⚛️", "color": "from-sky-200 to-indigo-300",
        "summary_kr": "매일 1%의 미세한 변화가 쌓여 삶을 획기적으로 바꾸는 습관의 과학.",
        "tags_kr": ["#습관성형", "#자기관리", "#갓생"]
    },
    {
        "title_kr": "원씽", "title_en": "The One Thing", "title_zh": "专注于一", "title_vi": "Điều ý nghĩa nhất",
        "author": "Gary Keller", "category": "self", "cover": "🎯", "color": "from-red-100 to-rose-200",
        "summary_kr": "성공을 방해하는 수많은 잡무를 걷어내고, 가장 중요한 단 하나에 집중하는 법.",
        "tags_kr": ["#선택과집중", "#생산성", "#일처리"]
    },
    {
        "title_kr": "역행자", "title_en": "Liferanker", "title_zh": "逆行者", "title_vi": "Kẻ ngược dòng",
        "author": "자청", "category": "self", "cover": "🧬", "color": "from-violet-200 to-fuchsia-300",
        "summary_kr": "돈, 시간, 운명으로부터 완전한 자유를 쟁취하는 7단계 공략 가이드.",
        "tags_kr": ["#자청", "#경제적자유", "#성공마인드"]
    },
    {
        "title_kr": "데일 카네기 인간관계론", "title_en": "How to Win Friends and Influence People", "title_zh": "人性的弱点", "title_vi": "Đắc nhân tâm",
        "author": "Dale Carnegie", "category": "self", "cover": "🤝", "color": "from-teal-100 to-blue-200",
        "summary_kr": "상대방의 마음을 열고 리더십을 발휘하는 대인관계 기술의 세계적 바이블.",
        "tags_kr": ["#대인관계", "#카네기", "#소통법"]
    },
    {
        "title_kr": "그릿", "title_en": "Grit", "title_zh": "坚毅", "title_vi": "Sức mạnh của sự kiên trì",
        "author": "Angela Duckworth", "category": "self", "cover": "🧗", "color": "from-stone-200 to-neutral-400",
        "summary_kr": "천재성을 이기는 열정과 끈기, 즉 그릿을 키우는 성공 마인드셋 설계안.",
        "tags_kr": ["#열정과끈기", "#그릿", "#의지력"]
    },
    {
        "title_kr": "타이탄의 도구들", "title_en": "Tools of Titans", "title_zh": "巨人的工具", "title_vi": "Công cụ của người khổng lồ",
        "author": "Tim Ferriss", "category": "self", "cover": "🛠️", "color": "from-amber-200 to-yellow-300",
        "summary_kr": "세계 최고 자리에 오른 200인의 습관, 루틴, 생각을 모은 실전 법칙들.",
        "tags_kr": ["#성공습관", "#팀페리스", "#인생조언"]
    },
    {
        "title_kr": "정리하는 뇌", "title_en": "The Organized Mind", "title_zh": "整理大脑", "title_vi": "Tổ chức tâm trí",
        "author": "Daniel J. Levitin", "category": "self", "cover": "🧠", "color": "from-slate-200 to-slate-400",
        "summary_kr": "정보 과부하 시대에 주의력과 기억력을 극대화하여 뇌를 효율적으로 쓰는 정리 과학.",
        "tags_kr": ["#뇌과학", "#주의집중", "#정리법"]
    },
    {
        "title_kr": "몰입", "title_en": "Flow", "title_zh": "心流", "title_vi": "Flow",
        "author": "황농문", "category": "self", "cover": "🌀", "color": "from-indigo-100 to-sky-200",
        "summary_kr": "잠재력을 깨우고 한계 돌파를 도우며 최고의 성과를 얻게 하는 몰입의 생각 훈련.",
        "tags_kr": ["#몰입", "#생각훈련", "#황농문"]
    },
    {
        "title_kr": "생각에 관한 생각", "title_en": "Thinking, Fast and Slow", "title_zh": "思考，快与慢", "title_vi": "Tư duy nhanh và chậm",
        "author": "Daniel Kahneman", "category": "self", "cover": "💭", "color": "from-blue-200 to-slate-300",
        "summary_kr": "인간의 판단과 선택을 조절하는 두 가지 시스템(빠른 직관, 느린 이성)에 대한 탐구.",
        "tags_kr": ["#의사결정", "#카너먼", "#행동경제"]
    },
    {
        "title_kr": "세이노의 가르침", "title_en": "SayNo's Teachings", "title_zh": "SayNo的教诲", "title_vi": "Lời dạy của SayNo",
        "author": "세이노", "category": "self", "cover": "🔥", "color": "from-red-200 to-orange-400",
        "summary_kr": "가난을 벗어나는 날카로운 직설과 인생 전반에 대한 뼈 때리는 조언.",
        "tags_kr": ["#인생조언", "#세이노", "#직설화법"]
    },
    {
        "title_kr": "기분이 태도가 되지 않게", "title_en": "Don't Let Your Mood Become Your Attitude", "title_zh": "不让情绪主导态度", "title_vi": "Đừng để tâm trạng làm chủ thái độ",
        "author": "레몬심리", "category": "self", "cover": "🧘", "color": "from-emerald-100 to-teal-200",
        "summary_kr": "순간의 나쁜 기분으로 소중한 관계를 망치지 않게 나를 관리하는 마음 관리법.",
        "tags_kr": ["#감정조절", "#마음다스림", "#관계"]
    },
    {
        "title_kr": "미움받을 용기", "title_en": "The Courage to Be Disliked", "title_zh": "被讨厌的勇气", "title_vi": "Dám bị ghét",
        "author": "기시미 이치로", "category": "self", "cover": "🦋", "color": "from-cyan-100 to-sky-200",
        "summary_kr": "타인의 평판이나 시선에서 벗어나 내 삶의 진정한 주체로 도약하는 심리 치료.",
        "tags_kr": ["#아들러심리", "#자존감", "#행복조건"]
    },
    {
        "title_kr": "프레임", "title_en": "Frame", "title_zh": "框架", "title_vi": "Khung tư duy",
        "author": "최인철", "category": "self", "cover": "🖼️", "color": "from-teal-200 to-cyan-300",
        "summary_kr": "세상을 바라보는 마음의 창인 프레임의 변화를 통해 지혜롭고 행복하게 사는 처방.",
        "tags_kr": ["#마음의틀", "#행복학", "#최인철"]
    },
    {
        "title_kr": "초집중", "title_en": "Indistractable", "title_zh": "超专注", "title_vi": "Siêu tập trung",
        "author": "Nir Eyal", "category": "self", "cover": "🎯", "color": "from-purple-200 to-rose-200",
        "summary_kr": "스마트폰과 각종 유혹이 가득한 알림 중심의 현대 사회에서 흔들리지 않고 집중하는 법.",
        "tags_kr": ["#집중력", "#시간관리", "#유혹대처"]
    },
    {
        "title_kr": "넛지", "title_en": "Nudge", "title_zh": "助推", "title_vi": "Cú hích",
        "author": "Richard Thaler", "category": "self", "cover": "👉", "color": "from-lime-200 to-emerald-300",
        "summary_kr": "강요하지 않고도 자연스럽게 사람들의 더 나은 선택을 유도하는 부드러운 개입의 힘.",
        "tags_kr": ["#넛지", "#행동유도", "#노벨상"]
    },
    {
        "title_kr": "아웃라이어", "title_en": "Outliers", "title_zh": "异类", "title_vi": "Những kẻ xuất chúng",
        "author": "Malcolm Gladwell", "category": "self", "cover": "⭐", "color": "from-amber-100 to-orange-200",
        "summary_kr": "성공의 기회를 포착하고 탁월한 성과를 거두는 아웃라이어들의 숨겨진 조건과 법칙.",
        "tags_kr": ["#1만시간의법칙", "#성공분석", "#기회"]
    },
    {
        "title_kr": "신경 끄기의 기술", "title_en": "The Subtle Art of Not Giving a F*ck", "title_zh": "关我屁事的技术", "title_vi": "Nghệ thuật tinh tế của việc đếch quan tâm",
        "author": "Mark Manson", "category": "self", "cover": "❄️", "color": "from-slate-200 to-zinc-400",
        "summary_kr": "수많은 쓸데없는 걱정과 비교를 버리고 가장 소중한 가치에만 에너지를 집중하는 지혜.",
        "tags_kr": ["#단순화", "#인생관리", "#마음비우기"]
    },
    {
        "title_kr": "미라클 모닝", "title_en": "The Miracle Morning", "title_zh": "奇迹早晨", "title_vi": "Buổi sáng kỳ diệu",
        "author": "Hal Elrod", "category": "self", "cover": "🌅", "color": "from-yellow-100 to-orange-300",
        "summary_kr": "매일 아침 6가지 간단한 루틴을 실천하며 하루를 최고의 에너지로 시작하는 아침 기적.",
        "tags_kr": ["#아침루틴", "#자기관리", "#기적의아침"]
    },
    {
        "title_kr": "배움은 우주를 품는 일이다", "title_en": "Learning to Embrace the Universe", "title_zh": "学习拥抱宇宙", "title_vi": "Học cách ôm lấy vũ trụ",
        "author": "이정모", "category": "self", "cover": "🪐", "color": "from-blue-200 to-indigo-400",
        "summary_kr": "끊임없이 배우고 호기심을 유지함으로써 내면과 삶의 반경을 넓히는 공부 철학.",
        "tags_kr": ["#평생공부", "#호기심", "#인생태도"]
    },
    {
        "title_kr": "회복탄력성", "title_en": "Resilience", "title_zh": "韧性", "title_vi": "Khả năng phục hồi",
        "author": "김주환", "category": "self", "cover": "🛡️", "color": "from-emerald-200 to-teal-300",
        "summary_kr": "역경과 시련을 이겨내고 오히려 도약의 발판으로 삼게 하는 마음의 근력 훈련법.",
        "tags_kr": ["#마음근력", "#긍정성", "#역경극복"]
    },

    # === Humanities (인문/역사/과학) - 20 unique books ===
    {
        "title_kr": "마흔에 읽는 쇼펜하우어", "title_en": "Schopenhauer at Forty", "title_zh": "四十读叔本华", "title_vi": "Đọc Schopenhauer tuổi 40",
        "author": "강용수", "category": "humanities", "cover": "🕯️", "color": "from-indigo-200 to-slate-300",
        "summary_kr": "고독과 고통을 인생의 연료로 삼았던 쇼펜하우어의 통찰력으로 배우는 내면 치유.",
        "tags_kr": ["#쇼펜하우어", "#인생철학", "#위로"]
    },
    {
        "title_kr": "사피엔스", "title_en": "Sapiens", "title_zh": "人类简史", "title_vi": "Sapiens: Lược sử loài người",
        "author": "Yuval Noah Harari", "category": "humanities", "cover": "💀", "color": "from-amber-200 to-stone-300",
        "summary_kr": "아프리카 동쪽 한 구석의 유인원에서 지구의 주인이 되기까지 인류 문명의 거대한 역사.",
        "tags_kr": ["#인류역사", "#하라리", "#문명사"]
    },
    {
        "title_kr": "도둑맞은 집중력", "title_en": "Stolen Focus", "title_zh": "被偷走的注意力", "title_vi": "Tập trung bị đánh cắp",
        "author": "Johann Hari", "category": "humanities", "cover": "📱", "color": "from-purple-100 to-indigo-200",
        "summary_kr": "현대 IT 기업과 사회 시스템이 어떻게 우리의 집중력을 교묘하게 앗아갔는지 밝힌 고찰.",
        "tags_kr": ["#집중력상실", "#주의력결핍", "#스마트폰장벽"]
    },
    {
        "title_kr": "정의란 무엇인가", "title_en": "Justice", "title_zh": "公正", "title_vi": "Phải trái đúng sai",
        "author": "Michael Sandel", "category": "humanities", "cover": "⚖️", "color": "from-rose-100 to-slate-200",
        "summary_kr": "하버드 역사상 가장 위대한 명강의 중 하나로 도덕적 딜레마를 풀며 정의를 생각하게 하는 명저.",
        "tags_kr": ["#정의론", "#공동체주의", "#하버드"]
    },
    {
        "title_kr": "총 균 쇠", "title_en": "Guns, Germs, and Steel", "title_zh": "枪炮、病菌与钢铁", "title_vi": "Súng, vi trùng và thép",
        "author": "Jared Diamond", "category": "humanities", "cover": "⚔️", "color": "from-stone-300 to-amber-200",
        "summary_kr": "인류 역사와 문명 발달의 격차가 인종이 아닌 환경과 지리적 조건 때문임을 밝힌 바이블.",
        "tags_kr": ["#제레드다이아몬드", "#지리결정론", "#역사학고전"]
    },
    {
        "title_kr": "지적 대화를 위한 넓고 얕은 지식 1", "title_en": "Broad and Shallow Knowledge for Intellectual Dialogue", "title_zh": "大历史的知识", "title_vi": "Kiến thức phổ thông",
        "author": "채사장", "category": "humanities", "cover": "📖", "color": "from-orange-100 to-amber-200",
        "summary_kr": "역사, 경제, 정치, 사회, 윤리를 관통하며 인문학 전반을 한눈에 보게 돕는 기초 교양서.",
        "tags_kr": ["#교양지식", "#인문학첫걸음", "#채사장"]
    },
    {
        "title_kr": "코스모스", "title_en": "Cosmos", "title_zh": "宇宙", "title_vi": "Vũ trụ",
        "author": "Carl Sagan", "category": "humanities", "cover": "🌌", "color": "from-indigo-300 to-zinc-400",
        "summary_kr": "광막한 우주의 대서사시 속에서 인류의 위치와 은하적 기원을 수려하게 설명하는 과학서.",
        "tags_kr": ["#칼세이건", "#천문학", "#우주명작"]
    },
    {
        "title_kr": "이기적 유전자", "title_en": "The Selfish Gene", "title_zh": "自私的基因", "title_vi": "Gen vị kỷ",
        "author": "Richard Dawkins", "category": "humanities", "cover": "🧬", "color": "from-green-100 to-teal-200",
        "summary_kr": "인류와 생명체가 생존 기계에 불과하며, 핵심은 유전자의 보존과 복제임을 증명한 고전.",
        "tags_kr": ["#진화생물학", "#도킨스", "#유전자복제"]
    },
    {
        "title_kr": "물고기는 존재하지 않는다", "title_en": "Why Fish Don't Exist", "title_zh": "鱼不存在", "title_vi": "Cá không tồn tại",
        "author": "Lulu Miller", "category": "humanities", "cover": "🐟", "color": "from-blue-200 to-cyan-300",
        "summary_kr": "데이비드 스타 조던의 전기를 다큐멘터리식으로 풀며 혼돈 속에서 삶의 희망을 건져내는 에세이.",
        "tags_kr": ["#과학에세이", "#삶의의미", "#베스트추천"]
    },
    {
        "title_kr": "공정하다는 착각", "title_en": "The Tyranny of Merit", "title_zh": "精英的傲慢", "title_vi": "Sự chuyên chế của năng lực",
        "author": "Michael Sandel", "category": "humanities", "cover": "🎓", "color": "from-rose-100 to-sky-100",
        "summary_kr": "능력주의가 어떻게 승자에게 오만을, 패자에게 굴욕을 주며 민주주의를 훼손하는지 진단한 고찰.",
        "tags_kr": ["#능력주의비판", "#마이클샌델", "#정치철학"]
    },
    {
        "title_kr": "호모 데우스", "title_en": "Homo Deus", "title_zh": "神人简史", "title_vi": "Homo Deus: Lược sử tương lai",
        "author": "Yuval Noah Harari", "category": "humanities", "cover": "🤖", "color": "from-stone-300 to-slate-400",
        "summary_kr": "기아와 역병을 정복한 인류가 신의 영역(불멸, 창조)에 도전하며 맞이할 미래의 시나리오.",
        "tags_kr": ["#유발하라리", "#미래전망", "#포스트휴먼"]
    },
    {
        "title_kr": "설민석의 조선왕조실록", "title_en": "Joseon Dynasty Annals", "title_zh": "朝鲜王朝实录", "title_vi": "Biên niên sử triều đại Joseon",
        "author": "설민석", "category": "humanities", "cover": "👑", "color": "from-amber-100 to-orange-200",
        "summary_kr": "조선왕조 500년의 역사를 핵심 에피소드 중심으로 쉽고 재미있게 풀어낸 대중 역사 가이드.",
        "tags_kr": ["#조선역사", "#대중교양", "#재미있는역사"]
    },
    {
        "title_kr": "침묵의 봄", "title_en": "Silent Spring", "title_zh": "寂静的春天", "title_vi": "Mùa xuân trầm lặng",
        "author": "Rachel Carson", "category": "humanities", "cover": "🦋", "color": "from-green-150 to-emerald-250",
        "summary_kr": "무분별한 살충제 사용이 생태계를 파괴하고 마침내 봄의 새소리를 멈추게 할 것임을 고발한 선언서.",
        "tags_kr": ["#환경학", "#레이첼카슨", "#생태학클래식"]
    },
    {
        "title_kr": "이적의 단어들", "title_en": "Lee Juck's Words", "title_zh": "李笛的词语", "title_vi": "Từ ngữ của Lee Juck",
        "author": "이적", "category": "humanities", "cover": "📝", "color": "from-fuchsia-100 to-pink-200",
        "summary_kr": "가수 이적이 일상 속 단어들을 빌려 쓴 섬세하고 사색적인 인생 에세이.",
        "tags_kr": ["#단어사색", "#이적", "#감성에세이"]
    },
    {
        "title_kr": "최재천의 곤충 사회", "title_en": "Insect Society", "title_zh": "昆虫社会", "title_vi": "Xã hội côn trùng",
        "author": "최재천", "category": "humanities", "cover": "🐜", "color": "from-green-200 to-yellow-200",
        "summary_kr": "개미와 벌의 고도화된 사회적 행동을 통해 인간 사회의 연대와 공존을 배우는 생물학서.",
        "tags_kr": ["#최재천", "#생물학", "#공존"]
    },
    {
        "title_kr": "어떻게 살 것인가", "title_en": "How to Live", "title_zh": "如何生活", "title_vi": "Sống thế nào",
        "author": "유시민", "category": "humanities", "cover": "🚶", "color": "from-slate-200 to-teal-200",
        "summary_kr": "정치와 작가 활동을 넘나든 유시민이 말하는 삶, 사랑, 일, 놀이의 균형적 고찰.",
        "tags_kr": ["#인생태도", "#유시민", "#인생철학"]
    },
    {
        "title_kr": "문과 남자의 과학 공부", "title_en": "Science Study of a Liberal Arts Man", "title_zh": "文科男的科学学习", "title_vi": "Học khoa học của chàng trai xã hội",
        "author": "유시민", "category": "humanities", "cover": "🧪", "color": "from-indigo-150 to-blue-250",
        "summary_kr": "인문학적 사유에 갇혀 있던 저자가 뇌과학, 진화생물학 등 자연과학을 배우며 넓힌 시선.",
        "tags_kr": ["#자연과학입문", "#인문학과과학", "#유시민"]
    },
    {
        "title_kr": "국화와 칼", "title_en": "The Chrysanthemum and the Sword", "title_zh": "菊花与刀", "title_vi": "Cúc và Gươm",
        "author": "Ruth Benedict", "category": "humanities", "cover": "🌸", "color": "from-rose-100 to-stone-200",
        "summary_kr": "일본 문화의 모순(극도의 예의와 호전성)을 예리한 문화인류학적 방법론으로 분석한 고전.",
        "tags_kr": ["#문화인류학", "#일본문화분석", "#베네딕트"]
    },
    {
        "title_kr": "소크라테스 익스프레스", "title_en": "The Socrates Express", "title_zh": "苏格拉底快车", "title_vi": "Chuyến tàu Socrates",
        "author": "Eric Weiner", "category": "humanities", "cover": "🚂", "color": "from-purple-100 to-indigo-200",
        "summary_kr": "마르쿠스 아우렐리우스부터 소크라테스까지 철학자들의 지혜를 현대 열차 여행에 녹인 유쾌한 책.",
        "tags_kr": ["#철학여행", "#유쾌한철학", "#인생지혜"]
    },
    {
        "title_kr": "서양미술사", "title_en": "The Story of Art", "title_zh": "艺术的故事", "title_vi": "Câu chuyện nghệ thuật",
        "author": "E.H. Gombrich", "category": "humanities", "cover": "🎨", "color": "from-amber-200 to-orange-300",
        "summary_kr": "선사시대 동굴 벽화에서 현대의 전위 미술까지 미술의 역사를 가장 일목요연하게 짚어낸 명작.",
        "tags_kr": ["#미술사", "#곰브리치", "#예술교양"]
    },

    # === Economy (경제/경영) - 20 unique books ===
    {
        "title_kr": "트렌드 코리아 2026", "title_en": "Trend Korea 2026", "title_zh": "趋势韩国 2026", "title_vi": "Xu xu hướng Hàn Quốc 2026",
        "author": "김난도 외", "category": "economy", "cover": "📈", "color": "from-emerald-200 to-teal-300",
        "summary_kr": "급변하는 시장에서 내년도 한국의 소비 트렌드를 한 권으로 분석하고 조망하는 바이블.",
        "tags_kr": ["#소비트렌드", "#비즈니스필독", "#김난도"]
    },
    {
        "title_kr": "돈의 속성", "title_en": "The Property of Money", "title_zh": "金钱的属性", "title_vi": "Thuộc tính của tiền",
        "author": "김승호", "category": "economy", "cover": "💰", "color": "from-emerald-100 to-yellow-200",
        "summary_kr": "글로벌 요식업체 스노우폭스 김승호 회장이 터득한, 돈을 대하는 인격적인 부의 가이드라인.",
        "tags_kr": ["#자산형성", "#김승호", "#마인드셋"]
    },
    {
        "title_kr": "부자 아빠 가난한 아빠 1", "title_en": "Rich Dad Poor Dad 1", "title_zh": "富爸爸穷爸爸 1", "title_vi": "Cha giàu cha nghèo 1",
        "author": "Robert Kiyosaki", "category": "economy", "cover": "🪙", "color": "from-teal-100 to-amber-200",
        "summary_kr": "노동 소득에서 자산에서 나오는 패시브 인컴으로 넘어가는 금융 지능 교육의 핵심 필독서.",
        "tags_kr": ["#금융문맹탈출", "#자산관리", "#기요사키"]
    },
    {
        "title_kr": "돈의 심리학", "title_en": "The Psychology of Money", "title_zh": "金钱心理", "title_vi": "Tâm lý học về tiền",
        "author": "Morgan Housel", "category": "economy", "cover": "📊", "color": "from-green-200 to-teal-300",
        "summary_kr": "성공적인 자산 축적은 수학 공식이 아닌, 행동 패턴과 심적 편향 제어에 달려 있음을 전하는 글.",
        "tags_kr": ["#행동재무학", "#행동방식", "#모건하우절"]
    },
    {
        "title_kr": "원칙", "title_en": "Principles", "title_zh": "原则", "title_vi": "Nguyên tắc",
        "author": "Ray Dalio", "category": "economy", "cover": "📋", "color": "from-stone-200 to-neutral-400",
        "summary_kr": "세계 최대 헤지펀드 브리지워터를 일군 레이 달리오의 일과 인생에 대한 확고한 체계.",
        "tags_kr": ["#레이달리오", "#경영철학", "#의사결정"]
    },
    {
        "title_kr": "부의 추월차선", "title_en": "The Millionaire Fastlane", "title_zh": "财富快车道", "title_vi": "Làn đường nhanh của sự giàu có",
        "author": "MJ DeMarco", "category": "economy", "cover": "🏎️", "color": "from-orange-250 to-red-350",
        "summary_kr": "직장인 생활을 지나 빠르게 젊은 나이에 부자가 될 수 있는 기업가적 추월차선 공식.",
        "tags_kr": ["#추월차선", "#창업가정신", "#빠른은퇴"]
    },
    {
        "title_kr": "제로 투 원", "title_en": "Zero to One", "title_zh": "从0到1", "title_vi": "Từ không đến một",
        "author": "Peter Thiel", "category": "economy", "cover": "🚀", "color": "from-blue-200 to-sky-300",
        "summary_kr": "경쟁을 피해 독점적인 가치를 만들고 새로운 시장을 개척하는 기술 스타트업의 통찰.",
        "tags_kr": ["#스타트업", "#피터틸", "#독점적가치"]
    },
    {
        "title_kr": "위대한 기업으로", "title_en": "Good to Great", "title_zh": "从优秀到卓越", "title_vi": "Từ tốt đến vĩ đại",
        "author": "Jim Collins", "category": "economy", "cover": "🏢", "color": "from-indigo-200 to-slate-400",
        "summary_kr": "좋은 기업을 넘어 위대하고 지속 가능한 기업으로 도약시키는 핵심 동력 규명.",
        "tags_kr": ["#기업성장", "#짐콜린스", "#경영학"]
    },
    {
        "title_kr": "지능형 투자자", "title_en": "The Intelligent Investor", "title_zh": "聪明的投资者", "title_vi": "Nhà đầu tư thông minh",
        "author": "Benjamin Graham", "category": "economy", "cover": "📈", "color": "from-teal-150 to-emerald-250",
        "summary_kr": "가치 투자의 창시자 벤자민 그레이엄이 정리한 영원히 변치 않는 안전 마진의 개념.",
        "tags_kr": ["#가치투자", "#안전마진", "#그레이엄"]
    },
    {
        "title_kr": "보도 섀퍼의 돈", "title_en": "The Road to Financial Freedom", "title_zh": "博多·舍费尔的金钱", "title_vi": "Đường đến tự do tài chính",
        "author": "Bodo Schäfer", "category": "economy", "cover": "🪙", "color": "from-amber-200 to-yellow-300",
        "summary_kr": "유럽 최고의 금융 코치 보도 섀퍼가 제시하는 7년 안에 첫 10억을 만드는 실전 로드맵.",
        "tags_kr": ["#금융자립", "#보도섀퍼", "#돈관리"]
    },
    {
        "title_kr": "주식투자 무작정 따라하기", "title_en": "Stock Investing for Beginners", "title_zh": "股票投资盲跟", "title_vi": "Đầu tư chứng khoán cho người mới bắt đầu",
        "author": "윤재수", "category": "economy", "cover": "📈", "color": "from-emerald-100 to-teal-200",
        "summary_kr": "주식 계좌 개설부터 기업 분석, 차트 리딩까지 초보 투자자가 알아야 할 기본 안내서.",
        "tags_kr": ["#주식초보", "#기초투자", "#윤재수"]
    },
    {
        "title_kr": "자본론", "title_en": "Capital", "title_zh": "资本论", "title_vi": "Tư bản luận",
        "author": "Karl Marx", "category": "economy", "cover": "📕", "color": "from-red-300 to-rose-400",
        "summary_kr": "자본주의 사회의 상품 가치와 잉여 가치 메커니즘을 심도 있게 분석한 마르크스의 역작.",
        "tags_kr": ["#마르크스", "#자본주의분석", "#정치경제"]
    },
    {
        "title_kr": "국부론", "title_en": "The Wealth of Nations", "title_zh": "国富论", "title_vi": "Của cải của các dân tộc",
        "author": "Adam Smith", "category": "economy", "cover": "🏛️", "color": "from-yellow-100 to-amber-300",
        "summary_kr": "'보이지 않는 손'에 의한 시장 경제 체제의 원리와 국부의 기원을 체계화한 바이블.",
        "tags_kr": ["#아담스미스", "#보이지않는손", "#고전경제"]
    },
    {
        "title_kr": "스킨 인 더 게임", "title_en": "Skin in the Game", "title_zh": "利益攸关", "title_vi": "Có trách nhiệm với quyết định",
        "author": "Nassim Taleb", "category": "economy", "cover": "🎲", "color": "from-rose-200 to-amber-300",
        "summary_kr": "의사 결정자가 직접 위험을 부담해야 하는 비대칭적 시스템 문제에 대한 나심 탈레브의 경고.",
        "tags_kr": ["#나심탈레브", "#위험분산", "#블랙스완"]
    },
    {
        "title_kr": "블랙 스완", "title_en": "The Black Swan", "title_zh": "黑天鹅", "title_vi": "Thiên nga đen",
        "author": "Nassim Taleb", "category": "economy", "cover": "🦢", "color": "from-slate-200 to-stone-400",
        "summary_kr": "극단적으로 발생 가능성이 낮지만 한번 일어나면 파급력이 엄청난 예기치 못한 재난에 대한 통찰.",
        "tags_kr": ["#블랙스완", "#무작위성", "#탈레브"]
    },
    {
        "title_kr": "경영학 원론", "title_en": "Principles of Management", "title_zh": "管理学原理", "title_vi": "Nguyên lý quản trị",
        "author": "이웅희", "category": "economy", "cover": "📚", "color": "from-blue-200 to-slate-300",
        "summary_kr": "조직 관리, 마케팅, 재무, 인사 등 현대 경영학의 뼈대를 설명하는 든든한 학문 기초.",
        "tags_kr": ["#경영기초", "#조직관리", "#대학강독"]
    },
    {
        "title_kr": "인플레이션에서 살아남기", "title_en": "Surviving Inflation", "title_zh": "在通胀中幸存", "title_vi": "Sống sót qua lạm phát",
        "author": "오건영", "category": "economy", "cover": "🎈", "color": "from-orange-100 to-red-200",
        "summary_kr": "금리, 환율, 원자재 가격 변동을 통해 인플레이션의 거시 경제 흐름을 쉽게 읽어주는 가이드.",
        "tags_kr": ["#오건영", "#금리공부", "#매크로경제"]
    },
    {
        "title_kr": "그리드", "title_en": "The Grid", "title_zh": "电力网", "title_vi": "Hệ thống lưới điện",
        "author": "Gretchen Bakke", "category": "economy", "cover": "🔌", "color": "from-yellow-200 to-teal-200",
        "summary_kr": "인류 역사상 가장 거대한 기계인 전력 네트워크 시스템과 미래 에너지 비즈니스의 조망.",
        "tags_kr": ["#에너지인프라", "#스마트그리드", "#기술경제"]
    },
    {
        "title_kr": "트렌드 코리아 2025", "title_en": "Trend Korea 2025", "title_zh": "趋势韩国 2025", "title_vi": "Xu hướng Hàn Quốc 2025",
        "author": "김난도 외", "category": "economy", "cover": "📊", "color": "from-teal-100 to-cyan-200",
        "summary_kr": "인구 절벽과 기술 융합 시대의 급격한 소비자 양상과 내년도 소비 10대 키워드 분석.",
        "tags_kr": ["#소비키워드", "#비즈니스준비", "#트렌드코리아"]
    },
    {
        "title_kr": "부의 시나리오", "title_en": "The Scenario of Wealth", "title_zh": "财富剧本", "title_vi": "Kịch bản giàu có",
        "author": "오건영", "category": "economy", "cover": "📝", "color": "from-sky-100 to-blue-200",
        "summary_kr": "고성장-고물가 등 4가지 시나리오별 포트폴리오를 제안하는 오건영의 친절한 투자 수업.",
        "tags_kr": ["#자산배분", "#포트폴리오", "#오건영"]
    },

    # === Poetry & Essay (시/에세이) - 20 unique books ===
    {
        "title_kr": "꽃을 보듯 너를 본다", "title_en": "I See You Like a Flower", "title_zh": "像看花一样看着你", "title_vi": "Nhìn em như nhìn một bông hoa",
        "author": "나태주", "category": "poetry", "cover": "🌸", "color": "from-pink-100 to-rose-200",
        "summary_kr": "독자들이 사랑하는 나태주 시인의 대표작인 '풀꽃'을 수록한 감성 어린 인생 시집.",
        "tags_kr": ["#나태주", "#풀꽃", "#힐링시집"]
    },
    {
        "title_kr": "하늘과 바람과 별과 시", "title_en": "The Sky, the Wind, the Stars, and Poetry", "title_zh": "天空、风、星星和诗", "title_vi": "Trời, gió, sao và thơ",
        "author": "윤동주", "category": "poetry", "cover": "🌌", "color": "from-purple-200 to-indigo-300",
        "summary_kr": "부끄러움 없는 순수한 소망을 담은 일제 강점기 청년 윤동주의 서정적이고 굳건한 외침.",
        "tags_kr": ["#서시", "#민족시인", "#윤동주"]
    },
    {
        "title_kr": "진달래꽃", "title_en": "Azalea Flowers", "title_zh": "金达莱花", "title_vi": "Hoa đỗ quyên",
        "author": "김소월", "category": "poetry", "cover": "🌺", "color": "from-rose-100 to-pink-300",
        "summary_kr": "한국 서정 시의 시초이자 민요풍의 가락으로 이별의 한과 그리움을 노래한 김소월의 시집.",
        "tags_kr": ["#김소월", "#전통가락", "#그리움"]
    },
    {
        "title_kr": "외로우니까 사람이다", "title_en": "Because We Are Lonely, We Are Human", "title_zh": "因为孤独所以是人", "title_vi": "Vì cô đơn nên là con người",
        "author": "정호승", "category": "poetry", "cover": "🕊️", "color": "from-sky-100 to-slate-200",
        "summary_kr": "'울지 마라 외로우니까 사람이다' 등 외로움의 본질을 통해 따스한 위로를 전하는 명시 모음.",
        "tags_kr": ["#정호승", "#외로움", "#따스한위로"]
    },
    {
        "title_kr": "입 속의 검은 잎", "title_en": "Black Leaf in Mouth", "title_zh": "口中的黑叶", "title_vi": "Lá đen trong miệng",
        "author": "기형도", "category": "poetry", "cover": "🍂", "color": "from-zinc-300 to-neutral-400",
        "summary_kr": "요절한 시인 기형도가 남긴, 현대 도시인의 소외감과 우울을 날카로운 상징으로 묘사한 불후의 시집.",
        "tags_kr": ["#기형도", "#우울미", "#현대시"]
    },
    {
        "title_kr": "서른, 잔치는 끝났다", "title_en": "Thirty, the Feast is Over", "title_zh": "三十，宴会结束了", "title_vi": "Tuổi ba mươi, tiệc đã tàn",
        "author": "최영미", "category": "poetry", "cover": "🍷", "color": "from-red-200 to-rose-350",
        "summary_kr": "1990년대 청춘의 환멸과 삶의 내면을 거침없고 명료한 언어로 포착한 최영미 시집.",
        "tags_kr": ["#최영미", "#90년대청춘", "#솔직함"]
    },
    {
        "title_kr": "보리피리", "title_en": "Barley Flute", "title_zh": "大麦笛", "title_vi": "Sáo lúa mạch",
        "author": "한하운", "category": "poetry", "cover": "🌾", "color": "from-lime-150 to-emerald-200",
        "summary_kr": "나병의 고통을 딛고 슬프면서도 초연한 소박함으로 삶을 노래한 한하운 시인의 대표작.",
        "tags_kr": ["#한하운", "#소박함", "#생의노래"]
    },
    {
        "title_kr": "서시", "title_en": "Prelude / Foreword", "title_zh": "序言", "title_vi": "Tựa",
        "author": "윤동주", "category": "poetry", "cover": "🌟", "color": "from-blue-200 to-indigo-300",
        "summary_kr": "‘죽는 날까지 하늘을 우러러 한 점 부끄럼이 없기를’ 간절히 바란 고뇌 어린 명시집.",
        "tags_kr": ["#윤동주", "#별을노래하는마음", "#서시"]
    },
    {
        "title_kr": "청록집", "title_en": "Blue Deer Collection", "title_zh": "青鹿集", "title_vi": "Tập thơ hươu xanh",
        "author": "박목월 외", "category": "poetry", "cover": "🦌", "color": "from-emerald-250 to-teal-350",
        "summary_kr": "박목월, 조지훈, 박두진의 자연에 대한 깊은 관조와 한국어의 아름다움을 담아낸 청록파 시집.",
        "tags_kr": ["#청록파", "#박목월", "#조지훈"]
    },
    {
        "title_kr": "향수", "title_en": "Nostalgia", "title_zh": "乡愁", "title_vi": "Nỗi nhớ quê hương",
        "author": "정지용", "category": "poetry", "cover": "🏡", "color": "from-amber-100 to-orange-200",
        "summary_kr": "'넓은 벌 동쪽 끝으로' 시작하는 감각적인 묘사로 고향에 대한 진한 그리움을 담은 시집.",
        "tags_kr": ["#정지용", "#고향그리움", "#향수"]
    },
    {
        "title_kr": "사랑하라 한번도 상처받지 않은 것처럼", "title_en": "Love as if You've Never Been Hurt", "title_zh": "去爱吧，如同不曾受过伤", "title_vi": "Yêu như chưa từng tổn thương",
        "author": "류시화 편", "category": "poetry", "cover": "❤️", "color": "from-pink-200 to-rose-300",
        "summary_kr": "세계 여러 시인들의 깊이 있고 영혼을 두드리는 잠언 시들을 류시화 시인이 엄선한 시집.",
        "tags_kr": ["#잠언시집", "#류시화", "#마음챙김"]
    },
    {
        "title_kr": "수선화에게", "title_en": "To the Daffodil", "title_zh": "致水仙花", "title_vi": "Gửi hoa thủy tiên",
        "author": "정호승", "category": "poetry", "cover": "🌼", "color": "from-yellow-100 to-amber-200",
        "summary_kr": "고독한 이들에게 가만히 위로의 손을 내미는 정호승 시인의 애잔하고 투명한 서정 시집.",
        "tags_kr": ["#정호승", "#수선화", "#고독안아주기"]
    },
    {
        "title_kr": "눈물은 왜 짠가", "title_en": "Why Tears Are Salty", "title_zh": "眼泪为什么咸", "title_vi": "Tại sao nước mắt lại mặn",
        "author": "함민복", "category": "poetry", "cover": "🥣", "color": "from-slate-100 to-zinc-300",
        "summary_kr": "가난하지만 따뜻했던 우리 이웃들의 소박한 일상을 정감 넘치게 노래한 함민복의 대표작.",
        "tags_kr": ["#함민복", "#따뜻한인정", "#소소한삶"]
    },
    {
        "title_kr": "슬픔이 기쁨에게", "title_en": "To Joy from Sadness", "title_zh": "悲伤致快乐", "title_vi": "Từ nỗi buồn gửi niềm vui",
        "author": "정호승", "category": "poetry", "cover": "🕯️", "color": "from-sky-150 to-indigo-250",
        "summary_kr": "타인의 슬픔을 외면하는 무정한 기쁨에게 진정한 인간다움을 깨우치게 하는 깊이 있는 시집.",
        "tags_kr": ["#정호승", "#더불어살기", "#인간다움"]
    },
    {
        "title_kr": "님의 침묵", "title_en": "The Silence of Love", "title_zh": "万海之沉默", "title_vi": "Sự im lặng của người yêu",
        "author": "한용운", "category": "poetry", "cover": "🕯️", "color": "from-neutral-200 to-stone-400",
        "summary_kr": "조국과 님을 향한 변치 않는 충절과 영원한 사랑을 고도의 비유로 노래한 만해 한용운의 대표작.",
        "tags_kr": ["#한용운", "#민족시집", "#님의침묵"]
    },
    {
        "title_kr": "접시꽃 당신", "title_en": "Daffodils for You", "title_zh": "蜀葵的你", "title_vi": "Em, hoa mẫu đơn",
        "author": "도종환", "category": "poetry", "cover": "🥀", "color": "from-red-100 to-rose-250",
        "summary_kr": "사별하는 아내를 향한 절절한 사랑과 그리움을 단아한 멜로디의 운율로 써낸 서정 시집.",
        "tags_kr": ["#도종환", "#부부사랑", "#사별애상"]
    },
    {
        "title_kr": "귀천", "title_en": "Return to Heaven", "title_zh": "归天", "title_vi": "Về trời",
        "author": "천상병", "category": "poetry", "cover": "☁️", "color": "from-slate-100 to-blue-200",
        "summary_kr": "'아름다운 이 세상 소풍 끝내는 날, 가서 아름다웠더라고 말하리라' 소박한 생의 예찬.",
        "tags_kr": ["#천상병", "#귀천", "#인생예찬"]
    },
    {
        "title_kr": "홀로 서기", "title_en": "Standing Alone", "title_zh": "独立", "title_vi": "Tự lập",
        "author": "서정윤", "category": "poetry", "cover": "🚶", "color": "from-neutral-100 to-slate-200",
        "summary_kr": "1980년대 청춘들의 마음을 사로잡은 고독과 진정한 홀로서기의 철학적 서정시.",
        "tags_kr": ["#서정윤", "#청춘시집", "#홀로서기"]
    },
    {
        "title_kr": "흔들리며 피는 꽃", "title_en": "Flowers That Bloom While Shaking", "title_zh": "在摇曳中盛开的花", "title_vi": "Hoa nở trong gió lay",
        "author": "도종환", "category": "poetry", "cover": "🌾", "color": "from-emerald-100 to-teal-200",
        "summary_kr": "인생의 모든 시련을 꽃이 바람에 흔들리며 피어나는 자연의 이치에 비유해 위로해주는 책.",
        "tags_kr": ["#시련극복", "#도종환", "#위로글"]
    },
    {
        "title_kr": "외로움 없는 방", "title_en": "A Room Without Loneliness", "title_zh": "没有孤独的房间", "title_vi": "Căn phòng không cô đơn",
        "author": "안톤 체호프", "category": "poetry", "cover": "🏠", "color": "from-stone-250 to-neutral-300",
        "summary_kr": "러시아 사실주의 문학의 거장 체호프가 묘사하는 인간의 고독과 섬세한 일상 에세이집.",
        "tags_kr": ["#러시아문학", "#체호프에세이", "#인간내면"]
    },

    # === Foreign (외국도서 원서) - 20 unique books ===
    {
        "title_kr": "달과 6펜스 (원서)", "title_en": "The Moon and Sixpence", "title_zh": "月亮与六便士", "title_vi": "Mặt trăng và đồng sáu xu",
        "author": "Somerset Maugham", "category": "foreign", "cover": "🌙", "color": "from-amber-100 to-yellow-250",
        "summary_kr": "세속적인 삶을 내던지고 오직 예술적 열정만을 따라 타히티로 떠난 화가의 대서사시.",
        "tags_kr": ["#원서읽기", "#예술소설", "#서머싯몸"]
    },
    {
        "title_kr": "위대한 개츠비 (원서)", "title_en": "The Great Gatsby", "title_zh": "伟大彼茨比", "title_vi": "Gatsby vĩ đại",
        "author": "F. Scott Fitzgerald", "category": "foreign", "cover": "🥂", "color": "from-yellow-100 to-amber-250",
        "summary_kr": "The classic novel portraying the tragic glamour of Gatsby's life and the disillusionment of the Jazz Age.",
        "tags_kr": ["#jazz-age", "#original-reading", "#fitzgerald"]
    },
    {
        "title_kr": "앵무새 죽이기 (원서)", "title_en": "To Kill a Mockingbird", "title_zh": "杀死一只知更鸟", "title_vi": "Giết con chim nhại",
        "author": "Harper Lee", "category": "foreign", "cover": "🐦", "color": "from-emerald-100 to-teal-200",
        "summary_kr": "Harper Lee's Pulitzer Prize-winning masterpiece exploring racism and justice in the American South.",
        "tags_kr": ["#pulitzer", "#justice", "#classic-novel"]
    },
    {
        "title_kr": "동물농장 (원서)", "title_en": "Animal Farm", "title_zh": "动物庄园", "title_vi": "Trại súc vật",
        "author": "George Orwell", "category": "foreign", "cover": "🐷", "color": "from-pink-100 to-stone-200",
        "summary_kr": "A satirical allegorical novella reflecting events leading up to the Russian Revolution.",
        "tags_kr": ["#orwell", "#satire", "#political-fable"]
    },
    {
        "title_kr": "호밀밭의 파수꾼 (원서)", "title_en": "The Catcher in the Rye", "title_zh": "麦田里的守望者", "title_vi": "Bắt trẻ đồng xanh",
        "author": "J.D. Salinger", "category": "foreign", "cover": "🧢", "color": "from-red-150 to-orange-250",
        "summary_kr": "The iconic novel of teenage alienation and rebellion narrated by the famous Holden Caulfield.",
        "tags_kr": ["#alienation", "#teen-classic", "#salinger"]
    },
    {
        "title_kr": "파리대왕 (원서)", "title_en": "Lord of the Flies", "title_zh": "蝇王", "title_vi": "Chúa ruồi",
        "author": "William Golding", "category": "foreign", "cover": "🏝️", "color": "from-green-200 to-stone-300",
        "summary_kr": "A chilling story about a group of boys stranded on an island and their descent into savagery.",
        "tags_kr": ["#savagery", "#golding", "#human-nature"]
    },
    {
        "title_kr": "오만과 편견 (원서)", "title_en": "Pride and Prejudice", "title_zh": "傲慢与偏见", "title_vi": "Kiêu hãnh và định kiến",
        "author": "Jane Austen", "category": "foreign", "cover": "👒", "color": "from-rose-100 to-yellow-250",
        "summary_kr": "The beloved romantic classic depicting the witty banter and growth of Elizabeth Bennet and Mr. Darcy.",
        "tags_kr": ["#jane-austen", "#romance", "#19th-century"]
    },
    {
        "title_kr": "멋진 신세계 (원서)", "title_en": "Brave New World", "title_zh": "美丽新世界", "title_vi": "Thế giới mới tươi đẹp",
        "author": "Aldous Huxley", "category": "foreign", "cover": "🧪", "color": "from-cyan-200 to-slate-350",
        "summary_kr": "A dystopian classic envisioning a genetically modified, painless but hollow future society.",
        "tags_kr": ["#dystopia", "#huxley", "#science-fiction"]
    },
    {
        "title_kr": "호빗 (원서)", "title_en": "The Hobbit", "title_zh": "霍比特人", "title_vi": "Anh chàng Hobbit",
        "author": "J.R.R. Tolkien", "category": "foreign", "cover": "💍", "color": "from-yellow-200 to-stone-400",
        "summary_kr": "The precursor to the Lord of the Rings, following Bilbo Baggins on a grand fantasy adventure.",
        "tags_kr": ["#tolkien", "#fantasy-adventure", "#middle-earth"]
    },
    {
        "title_kr": "연금술사 (원서)", "title_en": "The Alchemist", "title_zh": "炼金术士", "title_vi": "Nhà giả kim",
        "author": "Paulo Coelho", "category": "foreign", "cover": "🐑", "color": "from-amber-150 to-orange-250",
        "summary_kr": "The inspiring story of Santiago, an Andalusian shepherd boy searching for his Personal Legend.",
        "tags_kr": ["#destiny", "#coelho", "#inspirational"]
    },
    {
        "title_kr": "모리와 함께한 화요일 (원서)", "title_en": "Tuesdays with Morrie", "title_zh": "相约星期二", "title_vi": "Những thứ ba với thầy Morrie",
        "author": "Mitch Albom", "category": "foreign", "cover": "🎓", "color": "from-sky-100 to-indigo-200",
        "summary_kr": "A touching memoir of weekly meetings between a college professor dying of ALS and his former student.",
        "tags_kr": ["#life-lessons", "#als", "#memoir"]
    },
    {
        "title_kr": "죽음의 수용소에서 (원서)", "title_en": "Man's Search for Meaning", "title_zh": "活出意义来", "title_vi": "Đi tìm lẽ sống",
        "author": "Viktor Frankl", "category": "foreign", "cover": "⛓️", "color": "from-neutral-250 to-stone-450",
        "summary_kr": "Psychiatrist Viktor Frankl's memoir of surviving Nazi camps and introducing logotherapy.",
        "tags_kr": ["#holocaust", "#meaning", "#psychology"]
    },
    {
        "title_kr": "1984 (원서)", "title_en": "1984", "title_zh": "1984", "title_vi": "Một chín tám tư",
        "author": "George Orwell", "category": "foreign", "cover": "👁️", "color": "from-slate-300 to-zinc-450",
        "summary_kr": "The definitive dystopian classic portraying a totalitarian regime and the chilling gaze of Big Brother.",
        "tags_kr": ["#big-brother", "#orwell", "#totalitarianism"]
    },
    {
        "title_kr": "어린 왕자 (원서)", "title_en": "The Little Prince", "title_zh": "小王子", "title_vi": "Hoàng tử bé",
        "author": "Antoine de Saint-Exupéry", "category": "foreign", "cover": "🌹", "color": "from-rose-100 to-orange-200",
        "summary_kr": "A poetic tale of a pilot stranded in the desert meeting a young prince from asteroid B-612.",
        "tags_kr": ["#classic", "#little-prince", "#parable"]
    },
    {
        "title_kr": "노인과 바다 (원서)", "title_en": "The Old Man and the Sea", "title_zh": "老人与海", "title_vi": "Ông già và biển cả",
        "author": "Ernest Hemingway", "category": "foreign", "cover": "⛵", "color": "from-blue-200 to-slate-400",
        "summary_kr": "Hemingway's Nobel prize-winning novella about an old Cuban fisherman battling a giant marlin.",
        "tags_kr": ["#nobel-prize", "#hemingway", "#determination"]
    },
    {
        "title_kr": "생각에 관한 생각 (원서)", "title_en": "Thinking, Fast and Slow", "title_zh": "思考，快与慢", "title_vi": "Tư duy nhanh và chậm",
        "author": "Daniel Kahneman", "category": "foreign", "cover": "🧠", "color": "from-blue-200 to-slate-350",
        "summary_kr": "An deep dive into cognitive psychology and behavioral economics from a Nobel laureate.",
        "tags_kr": ["#kahneman", "#psychology", "#cognitive"]
    },
    {
        "title_kr": "사피엔스 (원서)", "title_en": "Sapiens", "title_zh": "人类简史", "title_vi": "Sapiens: Lược sử loài người",
        "author": "Yuval Noah Harari", "category": "foreign", "cover": "💀", "color": "from-amber-250 to-stone-350",
        "summary_kr": "The massive bestseller tracking the evolution and history of Homo Sapiens across three revolutions.",
        "tags_kr": ["#harari", "#anthropology", "#history"]
    },
    {
        "title_kr": "아주 작은 습관의 힘 (원서)", "title_en": "Atomic Habits", "title_zh": "原子习惯", "title_vi": "Thói quen nguyên tử",
        "author": "James Clear", "category": "foreign", "cover": "⚛️", "color": "from-sky-250 to-indigo-350",
        "summary_kr": "The practical framework for breaking bad habits and building good ones in 1% increments.",
        "tags_kr": ["#habits", "#james-clear", "#improvement"]
    },
    {
        "title_kr": "도둑맞은 집중력 (원서)", "title_en": "Stolen Focus", "title_zh": "被偷走的注意力", "title_vi": "Tập trung bị đánh cắp",
        "author": "Johann Hari", "category": "foreign", "cover": "📱", "color": "from-purple-250 to-indigo-350",
        "summary_kr": "The essential book on why our focus has been compromised by technology and attention theft.",
        "tags_kr": ["#focus", "#attention-theft", "#culture"]
    },
    {
        "title_kr": "침묵의 봄 (원서)", "title_en": "Silent Spring", "title_zh": "寂静的春天", "title_vi": "Mùa xuân trầm lặng",
        "author": "Rachel Carson", "category": "foreign", "cover": "🌲", "color": "from-green-250 to-emerald-350",
        "summary_kr": "The historic environmental science book that helped launch the modern conservation movement.",
        "tags_kr": ["#environment", "#carson", "#ecology"]
    }
]

# Publisher variations to create different editions
EDITIONS = [
    {"name_kr": "민음사 세계문학전집", "name_en": "Minumsa Edition"},
    {"name_kr": "문학동네 특별판", "name_en": "Munhakdongne Special Edition"},
    {"name_kr": "창비 양장본 에디션", "name_en": "Changbi Hardcover Edition"},
    {"name_kr": "열린책들 소장판", "name_en": "Open Books Collector's Edition"}
]

SHELVES = ["첫째 줄", "둘째 줄", "셋째 줄", "넷째 줄", "다섯째 줄"]

def main() -> None:
    print("[seed_books] Starting realistic database build...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Clear database
        db.query(Book).delete()
        db.commit()

        total_seeded = 0
        added_titles = set()

        # Step 1: Add all 120 unique real books as "Standard Edition"
        print("[seed_books] Seeding 120 unique base books...")
        for base in UNIQUE_REAL_BOOKS:
            title_kr = base["title_kr"]
            title_en = base["title_en"]
            title_zh = base["title_zh"]
            title_vi = base["title_vi"]

            # Save in added_titles to check for dupes later
            added_titles.add(title_kr)

            zones_map = {
                "fiction": ["A-1", "A-2", "A-3", "A-4"],
                "poetry": ["B-1", "B-2", "B-3"],
                "humanities": ["C-1", "C-2", "C-3", "C-4"],
                "self": ["D-1", "D-2", "D-3", "D-4"],
                "economy": ["E-1", "E-2", "E-3"],
                "foreign": ["F-1", "F-2", "F-3"]
            }
            zone = random.choice(zones_map[base["category"]])
            shelf = random.choice(SHELVES)
            in_stock = random.random() > 0.15 # 85% in stock

            db_book = Book(
                title_kr=title_kr,
                title_en=title_en,
                title_zh=title_zh,
                title_vi=title_vi,
                author=base["author"],
                category=base["category"],
                cover=base["cover"],
                color=base["color"],
                zone=zone,
                shelf=shelf,
                in_stock=in_stock,
                summary_kr=base["summary_kr"],
                summary_en=base.get("summary_en", f"An excellent work on '{title_en}' by {base['author']}."),
                summary_zh=base.get("summary_zh", f"《{title_zh}》是由 {base['author']} 撰写的优秀著作。"),
                summary_vi=base.get("summary_vi", f"Tác phẩm tuyệt vời về '{title_vi}' của tác giả {base['author']}."),
                for_whom_kr=json.dumps(base["tags_kr"]),
                for_whom_en=json.dumps([t.replace("#", "#tag-") for t in base["tags_kr"]]),
                for_whom_zh=json.dumps([t.replace("#", "#zh-") for t in base["tags_kr"]]),
                for_whom_vi=json.dumps([t.replace("#", "#vi-") for t in base["tags_kr"]])
            )
            db.add(db_book)
            total_seeded += 1

        # Step 2: Add ~90 publisher/special editions for some books to make the DB count exactly 210
        # This guarantees that at most a book will have 2 entries in total, reducing redundant name clutter!
        print("[seed_books] Seeding 90 publisher/special editions to reach 210 count...")
        random.seed(99)
        
        # We shuffle the list to choose random books to duplicate with a publisher edition
        shuffled_bases = list(UNIQUE_REAL_BOOKS)
        random.shuffle(shuffled_bases)

        for base in shuffled_bases:
            if total_seeded >= 210:
                break
            
            # Select an edition
            ed = random.choice(EDITIONS)
            title_kr = f"{base['title_kr']} ({ed['name_kr']})"
            title_en = f"{base['title_en']} ({ed['name_en']})"
            title_zh = f"{base['title_zh']} ({ed['name_kr']})"
            title_vi = f"{base['title_vi']} ({ed['name_en']})"

            if title_kr in added_titles:
                continue
            added_titles.add(title_kr)

            zones_map = {
                "fiction": ["A-1", "A-2", "A-3", "A-4"],
                "poetry": ["B-1", "B-2", "B-3"],
                "humanities": ["C-1", "C-2", "C-3", "C-4"],
                "self": ["D-1", "D-2", "D-3", "D-4"],
                "economy": ["E-1", "E-2", "E-3"],
                "foreign": ["F-1", "F-2", "F-3"]
            }
            zone = random.choice(zones_map[base["category"]])
            shelf = random.choice(SHELVES)
            in_stock = random.random() > 0.15 # 85% in stock

            db_book = Book(
                title_kr=title_kr,
                title_en=title_en,
                title_zh=title_zh,
                title_vi=title_vi,
                author=base["author"],
                category=base["category"],
                cover=base["cover"],
                color=base["color"],
                zone=zone,
                shelf=shelf,
                in_stock=in_stock,
                summary_kr=f"{base['summary_kr']} ({ed['name_kr']} 출판 에디션)",
                summary_en=f"{base.get('summary_en', base['title_kr'])} ({ed['name_en']})",
                summary_zh=f"{base.get('summary_zh', base['title_kr'])} ({ed['name_kr']}版)",
                summary_vi=f"{base.get('summary_vi', base['title_kr'])} (Bản dịch {ed['name_en']})",
                for_whom_kr=json.dumps(base["tags_kr"]),
                for_whom_en=json.dumps([t.replace("#", "#tag-") for t in base["tags_kr"]]),
                for_whom_zh=json.dumps([t.replace("#", "#zh-") for t in base["tags_kr"]]),
                for_whom_vi=json.dumps([t.replace("#", "#vi-") for t in base["tags_kr"]])
            )
            db.add(db_book)
            total_seeded += 1

        db.commit()
        print(f"[seed_books] Success! Total real books in MariaDB: {total_seeded}")

    except Exception as e:
        db.rollback()
        print(f"[seed_books] Seeding failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
