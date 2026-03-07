package scheduler

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/indusbase/indus-queue/internal/models"
	"github.com/indusbase/indus-queue/internal/repository"
	"github.com/robfig/cron/v3"
)

// CronScheduler schedules and triggers cron jobs
type CronScheduler struct {
	cronRepo  *repository.CronRepository
	jobRepo   *repository.JobRepository
	defaultTZ string
	cron      *cron.Cron
	schedules map[string]cron.EntryID
	wg        sync.WaitGroup
	ctx       context.Context
	cancel    context.CancelFunc
}

// NewCronScheduler creates a new cron scheduler
func NewCronScheduler(cronRepo *repository.CronRepository, jobRepo *repository.JobRepository, defaultTZ string) *CronScheduler {
	ctx, cancel := context.WithCancel(context.Background())

	// Load default timezone
	loc, err := time.LoadLocation(defaultTZ)
	if err != nil {
		log.Printf("Warning: failed to load timezone %s, using UTC: %v", defaultTZ, err)
		loc = time.UTC
	}

	return &CronScheduler{
		cronRepo:  cronRepo,
		jobRepo:   jobRepo,
		defaultTZ: defaultTZ,
		cron:      cron.New(cron.WithLocation(loc)),
		schedules: make(map[string]cron.EntryID),
		ctx:       ctx,
		cancel:    cancel,
	}
}

// Start starts the cron scheduler
func (s *CronScheduler) Start() {
	// Start the cron parser
	s.cron.Start()
	log.Println("Cron scheduler started")

	// Load existing schedules
	s.loadSchedules()

	// Start a goroutine to watch for new/updated schedules
	s.wg.Add(1)
	go s.watchSchedules()
}

// Stop stops the cron scheduler
func (s *CronScheduler) Stop() {
	s.cancel()
	s.cron.Stop()
	s.wg.Wait()
	log.Println("Cron scheduler stopped")
}

// loadSchedules loads all enabled cron schedules
func (s *CronScheduler) loadSchedules() {
	schedules, err := s.cronRepo.GetEnabled(s.ctx)
	if err != nil {
		log.Printf("Error loading cron schedules: %v", err)
		return
	}

	for _, schedule := range schedules {
		s.addSchedule(schedule)
	}
}

// addSchedule adds a cron schedule to the scheduler
func (s *CronScheduler) addSchedule(schedule *models.CronSchedule) {
	// Parse the cron expression
	_, err := cron.ParseStandard(schedule.CronExpression)
	if err != nil {
		log.Printf("Error parsing cron expression %s: %v", schedule.CronExpression, err)
		return
	}

	// Add to cron
	entryID, err := s.cron.AddFunc(schedule.CronExpression, func() {
		s.triggerJob(schedule)
	})
	if err != nil {
		log.Printf("Error adding cron schedule %s: %v", schedule.Name, err)
		return
	}

	s.schedules[schedule.ID] = entryID
	log.Printf("Added cron schedule: %s with expression: %s", schedule.Name, schedule.CronExpression)
}

// removeSchedule removes a cron schedule from the scheduler
func (s *CronScheduler) removeSchedule(scheduleID string) {
	if entryID, ok := s.schedules[scheduleID]; ok {
		s.cron.Remove(entryID)
		delete(s.schedules, scheduleID)
		log.Printf("Removed cron schedule: %s", scheduleID)
	}
}

// triggerJob triggers a job for a cron schedule
func (s *CronScheduler) triggerJob(schedule *models.CronSchedule) {
	log.Printf("Triggering cron schedule: %s", schedule.Name)

	// Parse job payload
	var jobPayload models.JobPayload
	if err := json.Unmarshal(schedule.JobPayload, &jobPayload); err != nil {
		log.Printf("Error parsing job payload for schedule %s: %v", schedule.Name, err)
		return
	}

	// Enqueue a job
	enqueueReq := models.EnqueueRequest{
		QueueName: jobPayload.QueueName,
		Payload:   jobPayload.Payload,
		Priority:  jobPayload.Priority,
	}

	job, err := s.jobRepo.Enqueue(s.ctx, enqueueReq)
	if err != nil {
		log.Printf("Error enqueuing job for schedule %s: %v", schedule.Name, err)
		return
	}

	log.Printf("Enqueued job %s for schedule %s", job.ID, schedule.Name)
}

// watchSchedules watches for changes to cron schedules
func (s *CronScheduler) watchSchedules() {
	defer s.wg.Done()

	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			return
		case <-ticker.C:
			s.loadSchedules()
		}
	}
}
