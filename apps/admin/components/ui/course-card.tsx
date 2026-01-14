import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Heart, Clock, Users, Star, Crown, ShoppingCart } from "lucide-react";

interface CourseCardProps {
  course: {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    price: number;
    isFree: boolean;
    duration: string;
    studentsCount: number;
    rating: number;
    instructor: string;
    progress?: number;
    isLiked?: boolean;
    tags: string[];
  };
  userType?: 'free' | 'premium';
  onLike?: (courseId: string) => void;
  onAddToCart?: (courseId: string) => void;
}

export const CourseCard = ({ course, userType, onLike, onAddToCart }: CourseCardProps) => {
  const canAccess = course.isFree || userType === 'premium';

  return (
    <Card className="card-educational group overflow-hidden">
      <div className="relative">
        <img
          src={course.thumbnail}
          alt={course.title}
          className="w-full h-48 object-cover transition-transform group-hover:scale-105"
        />

        {/* Price Badge */}
        <div className="absolute top-4 left-4">
          {course.isFree ? (
            <Badge className="btn-success font-semibold">
              Gratuit
            </Badge>
          ) : (
            <Badge className="bg-card text-card-foreground border border-border font-semibold">
              {course.price} Ar
            </Badge>
          )}
        </div>

        {/* Premium Badge */}
        {!course.isFree && userType === 'premium' && (
          <div className="absolute top-4 right-4">
            <Badge className="btn-premium">
              <Crown className="h-3 w-3 mr-1" />
              Inclus
            </Badge>
          </div>
        )}

        {/* Like Button */}
        <button
          onClick={() => onLike?.(course.id)}
          className="absolute bottom-4 right-4 p-2 bg-card/90 backdrop-blur-sm rounded-full border border-border hover:bg-card transition-colors"
        >
          <Heart
            className={`h-4 w-4 ${course.isLiked
                ? "fill-destructive text-destructive"
                : "text-muted-foreground hover:text-destructive"
              }`}
          />
        </button>
      </div>

      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold line-clamp-2 group-hover:text-primary transition-colors">
              {course.title}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground mt-1">
              par {course.instructor}
            </CardDescription>
          </div>
          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span>{course.rating}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
          {course.description}
        </p>

        {/* Course Meta */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>{course.duration}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Users className="h-3 w-3" />
              <span>{course.studentsCount}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar (if user is enrolled) */}
        {course.progress !== undefined && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Progression</span>
              <span>{course.progress}%</span>
            </div>
            <Progress value={course.progress} className="h-2" />
          </div>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {course.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        {canAccess ? (
          <Link to={`/courses/${course.id}`} className="w-full">
            <Button className="w-full btn-educational">
              {course.progress !== undefined ? "Continuer" : "Commencer"}
            </Button>
          </Link>
        ) : (
          <div className="flex w-full space-x-2">
            <Button
              onClick={() => onAddToCart?.(course.id)}
              className="flex-1"
              variant="outline"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Acheter
            </Button>
            <Link to={`/courses/${course.id}`} className="flex-1">
              <Button variant="secondary" className="w-full">
                Voir
              </Button>
            </Link>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};