import React from 'react';
import { Search, Filter, AlertTriangle, FileText, Clock, ChevronRight } from 'lucide-react';
import Badge from '../common/Badge';
import Button from '../common/Button';
import { useDoctor } from '../../context/DoctorContext';

const CaseList = () => {
  const {
    filteredCases,
    cases,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    selectCase,
    stats,
  } = useDoctor();

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Title and total count */}
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Patient Intake Queue</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {filteredCases.length} {filteredCases.length === 1 ? 'case' : 'cases'}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any patient case to review the AI summary, structured clinical history, and original transcript.
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by patient name or MED-XXXXX..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-100 mt-4">
          <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filters:
          </span>

          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            All Cases ({cases.length})
          </button>

          <button
            onClick={() => setFilter('red-flags')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              filter === 'red-flags'
                ? 'bg-red-700 text-white shadow-xs'
                : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/60'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Potential Red Flags ({stats.redFlags})</span>
          </button>

          <button
            onClick={() => setFilter('needs-review')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              filter === 'needs-review'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60'
            }`}
          >
            Needs Review ({stats.needsReview})
          </button>

          <button
            onClick={() => setFilter('reviewed')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              filter === 'reviewed'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
            }`}
          >
            Reviewed / Accepted ({stats.reviewed})
          </button>
        </div>
      </div>

      {/* Cases Table / Card List */}
      {filteredCases.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">No matching patient cases found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            Try adjusting your search keywords or switching filter tabs to view available intake records.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setFilter('all');
            }}
          >
            Reset Filters
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCases.map((c) => {
            const hasRedFlag = c.hasRedFlags && c.redFlags.length > 0;
            const hasReports = c.reports && c.reports.length > 0;

            return (
              <div
                key={c.id}
                onClick={() => selectCase(c.id)}
                className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group ${
                  hasRedFlag
                    ? 'border-red-200/90 hover:border-red-300'
                    : 'border-slate-200/90 hover:border-blue-300'
                }`}
              >
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  {/* Left Column: Patient Profile & Identification */}
                  <div className="flex items-start gap-3.5">
                    {/* Patient Avatar Initials */}
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                        hasRedFlag
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200/70'
                      }`}
                    >
                      {c.patient.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </div>

                    {/* Patient Name, Age, ID */}
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition-colors">
                          {c.patient.name}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          ({c.patient.age} Y, {c.patient.gender})
                        </span>
                        <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          {c.intakeId}
                        </span>

                        {hasRedFlag && (
                          <Badge variant="rose" size="sm" dot={true}>
                            Potential Red Flag
                          </Badge>
                        )}
                      </div>

                      {/* Chief Complaint */}
                      <p className="text-xs sm:text-sm text-slate-700 font-medium mt-1 leading-relaxed">
                        <span className="text-slate-500 font-normal">Chief Complaint: </span>
                        {c.chiefComplaint}
                      </p>

                      {/* Meta information */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {c.intakeTime}
                        </span>

                        {c.patient.bloodGroup && (
                          <span className="font-semibold text-slate-600">
                            Blood: {c.patient.bloodGroup}
                          </span>
                        )}

                        {hasReports && (
                          <span className="inline-flex items-center gap-1 text-teal-700 font-medium bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/80">
                            <FileText className="w-3 h-3 text-teal-600" />
                            {c.reports.length} {c.reports.length === 1 ? 'Report' : 'Reports'} (Labs)
                          </span>
                        )}

                        {c.patient.abhaId && (
                          <span className="hidden sm:inline text-slate-400 font-mono">
                            ABHA: {c.patient.abhaId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Status Badges & Action */}
                  <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    <div className="flex items-center gap-2">
                      {c.reviewStatus === 'Needs Review' && (
                        <Badge variant="blue" size="md" dot={true}>
                          Needs Review
                        </Badge>
                      )}
                      {c.reviewStatus === 'Reviewed' && (
                        <Badge variant="emerald" size="md" dot={true}>
                          Reviewed
                        </Badge>
                      )}
                      {c.reviewStatus === 'Accepted' && (
                        <Badge variant="teal" size="md" dot={true}>
                          Accepted / In OPD
                        </Badge>
                      )}
                    </div>

                    <Button
                      variant={hasRedFlag ? 'dangerSolid' : 'outline'}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectCase(c.id);
                      }}
                      icon={ChevronRight}
                      iconPosition="right"
                      className="text-xs font-semibold"
                    >
                      Review Case
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CaseList;
