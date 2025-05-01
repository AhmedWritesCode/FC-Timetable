class SubjectManager {
    constructor() {
        this.baseUrl = "http://web.fc.utm.my/ttms/web_man_webservice_json.cgi";
        this.authAdminUrl = "http://web.fc.utm.my/ttms/auth-admin.php";
    }


    // Fetch the subjects of the latest semester for students
    async fetchLatestSemesterStudentSubjects(studentId) {
        const subjects = await this.fetchStudentSubjects(studentId);
        
        // Determine the latest session
        const latestSession = subjects.reduce((latest, subject) => {
            return (latest.sesi < subject.sesi) ? subject : latest;
        }, subjects[0]);

        // Filter subjects for the latest semester
        const latestSemesterSubjects = subjects.filter(subject => {
            return subject.sesi === latestSession.sesi && subject.semester === latestSession.semester;
        });

        return latestSemesterSubjects;
    }

    // Fetch the subjects of the latest semester for lecturers
    async fetchLatestSemesterLecturerSubjects(lecturerId) {
        const subjects = await this.fetchLecturerSubjects(lecturerId);
        
        // Determine the latest session
        const latestSession = subjects.reduce((latest, subject) => {
            return (latest.sesi < subject.sesi) ? subject : latest;
        }, subjects[0]);

        // Filter subjects for the latest semester
        const latestSemesterSubjects = subjects.filter(subject => {
            return subject.sesi === latestSession.sesi && subject.semester === latestSession.semester;
        });

        return latestSemesterSubjects;
    }

    // Fetch the timetable for a specific subject
    async fetchSubjectTimetable(kodSubjek, sesi, semester, seksyen) {
        const url = `${this.baseUrl}?entity=jadual_subjek&sesi=${sesi}&semester=${semester}&kod_subjek=${kodSubjek}&seksyen=${seksyen}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Error fetching subject timetable:", error);
            return [];
        }
    }
    
    // Function to fetch admin session ID
    async fetchAdminSessionId(userSessionId) {
        const url = `${this.authAdminUrl}?session_id=${userSessionId}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data && data.length > 0 && data[0].session_id) {
                return data[0].session_id;
            } else {
                throw new Error("Admin session ID not found in response");
            }
        } catch (error) {
            console.error("Error fetching admin session ID:", error);
            return null;
        }
    }

    // Fetch all subjects for a given student ID
    async fetchStudentSubjects(studentId) {
        const url = `${this.baseUrl}?entity=pelajar_subjek&no_matrik=${studentId}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Error fetching student subjects:", error);
            return [];
        }
    }

    // Fetch all subjects for a given lecturer ID
    async fetchLecturerSubjects(lecturerId) {
        const url = `${this.baseUrl}?entity=pensyarah_subjek&no_pekerja=${lecturerId}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Error fetching lecturer subjects:", error);
            return [];
        }
    }

    // Fetch subjects for the last semester
    async fetchSubjectsLastSemester(sesi, semester) {
        const url = `${this.baseUrl}?entity=subjek_seksyen&sesi=${sesi}&semester=${semester}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Error fetching subjects for last semester:", error);
            return [];
        }
    }

    // Fetch students from a specific section
    async fetchStudentsFromSection(adminSessionId, sesi, semester, kodSubjek, seksyen) {
        const url = `${this.baseUrl}?entity=subjek_pelajar&session_id=${adminSessionId}&sesi=${sesi}&semester=${semester}&kod_subjek=${kodSubjek}&seksyen=${seksyen}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Error fetching students from section:", error);
            return [];
        }
    }

    // Fetch all lecturers
    async fetchAllLecturers(adminSessionId, sesi, semester) {
        const url = `${this.baseUrl}?entity=pensyarah&session_id=${adminSessionId}&sesi=${sesi}&semester=${semester}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Error fetching lecturers:", error);
            return [];
        }
    }

    // Fetch all students (with pagination)
    async fetchAllStudents(adminSessionId, sesi, semester) {
        let students = [];
        let offset = 0;
        const limit = 1000;
        let moreData = true;
        const maxIterations = 70; // Maximum number of iterations to prevent infinite loops
        let iterations = 0;

        while (moreData && iterations < maxIterations) {
            const url = `${this.baseUrl}?entity=pelajar&session_id=${adminSessionId}&sesi=${sesi}&semester=${semester}&limit=${limit}&offset=${offset}`;
            console.log(`Fetching students with offset: ${offset}, limit: ${limit}`);
            try {
                const response = await fetch(url);
                const data = await response.json();
                console.log(`Fetched ${data.length} students`);
                
                // Check if the result is empty or just an empty sample result
                if (data.length > 1 || (data.length === 1 && data[0] && Object.keys(data[0]).length > 0)) {
                    students = students.concat(data);
                    offset += limit;
                    iterations++;
                    if (data.length < limit) {
                        moreData = false;
                    }
                } else {
                    moreData = false;
                }
            } catch (error) {
                console.error("Error fetching students:", error);
                moreData = false;
            }
        }

        if (iterations >= maxIterations) {
            console.warn("Reached maximum iterations limit. Stopping further requests.");
        }

        return students;
    }
    async fetchAllStudentsFromAllSections(adminSessionId, sesi, semester) {
        const subjects = await this.fetchSubjectsLastSemester(sesi, semester);
        const allStudentsMap = new Map();
        const validSections = subjects.flatMap(subject =>
            subject.seksyen_list.filter(section => section.bil_pelajar > 0).map(section => ({
                kod_subjek: subject.kod_subjek,
                seksyen: section.seksyen,
                bil_pelajar: section.bil_pelajar
            }))
        );

        for (const { kod_subjek, seksyen, bil_pelajar } of validSections) {
            const beforeCount = allStudentsMap.size;
            try {
                const students = await this.fetchStudentsFromSection(adminSessionId, sesi, semester, kod_subjek, seksyen);
                students.forEach(student => {
                    allStudentsMap.set(student.no_kp, student.nama);
                });
                const afterCount = allStudentsMap.size;
                console.log(`Fetched ${bil_pelajar} students from subject: ${kod_subjek}, section: ${seksyen}. Mapped students before: ${beforeCount}, after: ${afterCount}`);
            } catch (error) {
                console.error(`Error fetching students from subject: ${kod_subjek}, section: ${seksyen}`, error);
            }
        }

        const allStudents = Array.from(allStudentsMap.entries()).map(([no_kp, nama]) => ({ no_kp, nama }));
        return allStudents;
    }


    // Fetch all students from elective subjects since 2010
    async fetchAllStudentsFromElectiveSubjects(adminSessionId) {
        const allStudentsMap = new Map();
        const fetchBatchSize = 10;

        // Function to fetch subjects for a given session and semester
        const fetchSubjects = async (sesi, semester) => {
            const url = `${this.baseUrl}?entity=subjek_seksyen&sesi=${sesi}&semester=${semester}`;
            try {
                const response = await fetch(url);
                const data = await response.json();
                return data
                    .filter(subject => subject.kod_subjek.startsWith('U') && subject.seksyen_list)
                    .flatMap(subject =>
                        subject.seksyen_list.filter(section => section.bil_pelajar > 0).map(section => ({
                            kod_subjek: subject.kod_subjek,
                            seksyen: section.seksyen,
                            bil_pelajar: section.bil_pelajar,
                            sesi,
                            semester
                        }))
                    );
            } catch (error) {
                console.error(`Error fetching subjects for sesi: ${sesi}, semester: ${semester}`, error);
                return [];
            }
        };

        // Iterate through sessions and semesters
        for (let year = 2010; year <= 2023; year++) {
            const sesi = `${year}/${year + 1}`;
            for (let semester = 1; semester <= 2; semester++) {
                console.log(`Fetching subjects for sesi: ${sesi}, semester: ${semester}`);
                const electiveSections = await fetchSubjects(sesi, semester);

                for (let i = 0; i < electiveSections.length; i += fetchBatchSize) {
                    const batch = electiveSections.slice(i, i + fetchBatchSize);
                    const fetchStudentsPromises = batch.map(({ kod_subjek, seksyen, bil_pelajar, sesi, semester }) => {
                        const beforeCount = allStudentsMap.size;
                        return this.fetchStudentsFromSection(adminSessionId, sesi, semester, kod_subjek, seksyen)
                            .then(students => {
                                students.forEach(student => {
                                    allStudentsMap.set(student.no_kp, student.nama);
                                });
                                const afterCount = allStudentsMap.size;
                                console.log(`Fetched ${bil_pelajar} students from subject: ${kod_subjek}, section: ${seksyen}. Mapped students before: ${beforeCount}, after: ${afterCount}`);
                            })
                            .catch(error => {
                                console.error(`Error fetching students from subject: ${kod_subjek}, section: ${seksyen}`, error);
                            });
                    });

                    await Promise.all(fetchStudentsPromises);
                }
            }
        }

        const allStudents = Array.from(allStudentsMap.entries()).map(([no_kp, nama]) => ({ no_kp, nama }));
        return allStudents;
    }
    // Fetch all students since 2010 (with pagination)
    async fetchAllStudentsSince2010(adminSessionId) {
        let allStudents = [];
        const limit = 1000;
        const maxIterations = 70; // Maximum number of iterations to prevent infinite loops

        // Function to fetch students for a given session and semester
        const fetchStudents = async (sesi, semester) => {
            let students = [];
            let offset = 0;
            let moreData = true;
            let iterations = 0;

            while (moreData && iterations < maxIterations) {
                const url = `${this.baseUrl}?entity=pelajar&session_id=${adminSessionId}&sesi=${sesi}&semester=${semester}&limit=${limit}&offset=${offset}`;
                console.log(`Fetching students with offset: ${offset}, limit: ${limit}`);
                try {
                    const response = await fetch(url);
                    const data = await response.json();
                    console.log(`Fetched ${data.length} students`);

                    // Check if the result is empty or just an empty sample result
                    if (data.length > 1 || (data.length === 1 && data[0] && Object.keys(data[0]).length > 0)) {
                        students = students.concat(data);
                        offset += limit;
                        iterations++;
                        if (data.length < limit) {
                            moreData = false;
                        }
                    } else {
                        moreData = false;
                    }
                } catch (error) {
                    console.error(`Error fetching students for sesi: ${sesi}, semester: ${semester}`, error);
                    moreData = false;
                }
            }

            if (iterations >= maxIterations) {
                console.warn("Reached maximum iterations limit. Stopping further requests.");
            }

            return students;
        };

        // Iterate through sessions and semesters
        for (let year = 2010; year <= 2023; year++) {
            const sesi = `${year}/${year + 1}`;
            for (let semester = 1; semester <= 2; semester++) {
                console.log(`Fetching students for sesi: ${sesi}, semester: ${semester}`);
                const students = await fetchStudents(sesi, semester);
                allStudents = allStudents.concat(students);
            }
        }

        // Deduplicate students
        const allStudentsMap = new Map();
        allStudents.forEach(student => {
            allStudentsMap.set(student.no_kp, student.nama);
        });

        const uniqueStudents = Array.from(allStudentsMap.entries()).map(([no_kp, nama]) => ({ no_kp, nama }));
        return uniqueStudents;
    }
}
